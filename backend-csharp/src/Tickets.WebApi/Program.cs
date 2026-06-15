using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Tickets.Application;
using Tickets.Application.Abstractions;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Common.Json;
using Tickets.Domain.Staff;
using Tickets.Infrastructure;
using Tickets.WebApi.Endpoints;
using Tickets.WebApi.Identity;
using Tickets.WebApi.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture));

// ───── App composition ─────────────────────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// HttpContext-bound identity adapters.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
builder.Services.AddScoped<ICurrentDevice, HttpContextCurrentDevice>();

// ───── JWT Bearer (App JWT — Phase 5 swaps in Microsoft.Identity.Web) ─
// AppJwtOptions is bound in AddInfrastructure(); read the same section here
// to wire up bearer validation.
var jwtOptions = builder.Configuration
    .GetSection(AppJwtOptions.SectionName)
    .Get<AppJwtOptions>() ?? new AppJwtOptions();

// A6 hardening: refuse to start with a weak/absent signing key outside
// Development. HS256 requires a key of at least 256 bits (32 bytes). Previously
// an empty key silently fell back to a dummy 'x'*64 string, which let the API
// boot with a publicly-known signing key — a critical auth bypass in prod.
var signingKeyBytes = string.IsNullOrEmpty(jwtOptions.SigningKey)
    ? 0
    : Encoding.UTF8.GetByteCount(jwtOptions.SigningKey);
if (signingKeyBytes < 32)
{
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "AppJwt:SigningKey must be configured with at least 32 bytes (256 bits) " +
            "outside the Development environment.");
    }

    // Development-only fallback so local runs / non-Docker tests still boot.
    // Not silent: emit a loud warning so a developer never mistakes the
    // ephemeral dev key for a configured one.
    Console.Error.WriteLine(
        "[WARN] AppJwt:SigningKey is missing or shorter than 32 bytes. " +
        "Falling back to an insecure Development-only key. " +
        "Configure AppJwt:SigningKey (>= 32 bytes) before any non-Development run.");
    jwtOptions.SigningKey = new string('x', 64);
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    // Staff App-JWT. SECURITY: audience is pinned to the STAFF audience
    // (jwtOptions.Audience). A device App-JWT carries the distinct
    // DeviceAudience, so it FAILS this validation and can never authenticate
    // against staff endpoints — closing the privilege-escalation hole.
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep 'sub' / 'role' verbatim
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            NameClaimType = "sub",
            RoleClaimType = "role",
        };
    })
    // Device App-JWT bearer. Validates the DEVICE audience + token_use=device,
    // so ONLY device tokens authenticate here. Used by /api/signalr/negotiate
    // (the iPad presents this App-JWT as Bearer). It is deliberately NOT part of
    // the default authorization policy, so it cannot reach staff endpoints.
    .AddJwtBearer(DeviceAuthSchemeDefaults.JwtScheme, options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.DeviceAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            NameClaimType = AppJwtClaims.DeviceId,
        };
        options.Events = new JwtBearerEvents
        {
            // Defence in depth: even with the right audience, require the
            // token_use=device discriminator before accepting the principal.
            OnTokenValidated = ctx =>
            {
                var tokenUse = ctx.Principal?.FindFirst(AppJwtClaims.TokenUse)?.Value;
                if (!string.Equals(tokenUse, AppJwtClaims.DeviceTokenUse, StringComparison.Ordinal))
                {
                    ctx.Fail("token_use must be 'device'.");
                }

                return Task.CompletedTask;
            },
        };
    })
    .AddScheme<DeviceAuthSchemeOptions, DeviceAuthSchemeHandler>(
        DeviceAuthSchemeDefaults.Scheme, _ => { });
builder.Services.AddAuthorization(options =>
{
    // SECURITY: the default policy (used by bare .RequireAuthorization() on the
    // staff endpoints) now requires the staff JwtBearer scheme AND a staff role.
    // A device App-JWT (different audience + no role claim) therefore yields 401
    // on every staff route. Previously bare .RequireAuthorization() accepted any
    // authenticated principal under any registered scheme.
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .RequireRole(nameof(StaffRole.Staff), nameof(StaffRole.Admin))
        .Build();

    options.AddSignalRNegotiatePolicy();
    // A6: device-only policy for POST /cases — only the Device auth scheme,
    // authenticated principal required (anonymous → 401, staff JWT → 403).
    options.AddPolicy(DeviceAuthSchemeDefaults.Policy, policy => policy
        .AddAuthenticationSchemes(DeviceAuthSchemeDefaults.Scheme)
        .RequireAuthenticatedUser());
});

// Webhook signature options (Azure SignalR upstream verification, #10).
// The HMAC key is the SignalR AccessKey. Source it from:
//   1. explicit SignalRWebhook:AccessKeys[] (bound below), then
//   2. the AccessKey parsed from the Azure SignalR connection string.
// Accepting both lets tests / non-Azure setups inject a key directly while
// production derives it from the real connection string (incl. secondary key
// rotation). Fail-closed if neither yields a key.
builder.Services
    .AddOptions<WebhookSignatureOptions>()
    .Bind(builder.Configuration.GetSection(WebhookSignatureOptions.SectionName))
    .PostConfigure(opts =>
    {
        var connectionString =
            builder.Configuration[$"{Tickets.Infrastructure.Notifications.AzureSignalROptions.SectionName}:ConnectionString"]
            ?? builder.Configuration["AZURE_SIGNALR_CONNECTION_STRING"];
        var parsed = SignalRConnectionString.ExtractAccessKey(connectionString);
        if (!string.IsNullOrWhiteSpace(parsed) && !opts.AccessKeys.Contains(parsed))
        {
            opts.AccessKeys.Add(parsed);
        }
    });

// ───── Forwarded headers (#8) ─────────────────────────────────────────
// Behind Azure Container Apps' managed ingress, TLS terminates at the edge and
// the app sees plain HTTP. Without honoring X-Forwarded-Proto/-Host, the
// /auth/login redirect_uri is built as http://… and Entra rejects it. Honor the
// proto + host so BuildRedirectUri / BuildRedirectUri yield https://<public-host>.
//
// The managed ingress is an untrusted-from-our-POV reverse proxy on a dynamic
// internal IP, so we CANNOT enumerate KnownProxies/KnownNetworks. Clearing them
// makes ASP.NET accept the forwarded values from the immediate (ingress) hop.
// This is the documented pattern for Container Apps / App Service style managed
// ingress; the platform strips client-supplied X-Forwarded-* before they reach
// the app, so this does not let an external caller spoof the proto/host.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// ───── Microsoft Entra (Azure AD) staff login handshake ───────────────
// Authorization-code flow only; the session token stays the App-JWT bearer
// scheme above, so existing tests and the device scheme are unaffected.
builder.Services
    .AddOptions<AzureAdOptions>()
    .Bind(builder.Configuration.GetSection(AzureAdOptions.SectionName));
builder.Services
    .AddHttpClient<IEntraCodeExchanger, EntraCodeExchanger>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Minimal-API JSON: camelCase property names to match the SignalR client
// contract and the rest of the API surface, plus the wire-enum converters so
// CaseStatus / DeviceMode / DeviceStatus serialize as the legacy UPPER_SNAKE
// strings the frontend + iPad expect (QUEUED, IN_PROGRESS,
// RESOLVED_PENDING_FEEDBACK, RESOLVED / REGISTRATION, FEEDBACK / OFFLINE, IDLE,
// BUSY) — NOT PascalCase.
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    WireJson.AddWireEnumConverters(o.SerializerOptions);
});

// CORS (#9) — bound from "Cors:AllowedOrigins" config array. The frontend uses
// cookies (the __Host-app_rf refresh cookie) on /auth/refresh, so the browser
// sends credentials cross-origin; that REQUIRES AllowCredentials() together with
// an explicit origin allow-list. A wildcard '*' is forbidden with credentials,
// so each origin MUST be listed.
//
// DEPLOY: set each origin via env var, zero-indexed:
//   Cors__AllowedOrigins__0=https://app.example.com
//   Cors__AllowedOrigins__1=https://admin.example.com
// (double-underscore maps to the "Cors:AllowedOrigins" config array). If NONE
// are set the policy matches no origin and every cross-origin browser call is
// blocked — fail-closed, and a loud signal that config is missing.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();
if (allowedOrigins.Length == 0)
{
    Console.Error.WriteLine(
        "[WARN] No Cors:AllowedOrigins configured. Cross-origin browser requests " +
        "(SPA → API) will be blocked. Set Cors__AllowedOrigins__0=<frontend origin>.");
}
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(p => p
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

var app = builder.Build();

// #8: must run FIRST so Request.Scheme/Host reflect the public https origin for
// every downstream component (auth redirect_uri, CORS, logging).
app.UseForwardedHeaders();

app.UseSerilogRequestLogging();
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseCors();

// Webhook signature verification only on the SignalR webhook prefix.
app.UseWhen(
    ctx => ctx.Request.Path.StartsWithSegments("/api/signalr/webhook")
        && !ctx.Request.Path.StartsWithSegments("/api/signalr/webhook/health"),
    branch => branch.UseMiddleware<WebhookSignatureMiddleware>());

app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous();

app.MapAuthEndpoints();
app.MapAuthAzureAdEndpoints();
app.MapCasesEndpoints();
app.MapDeviceEndpoints();
app.MapFeedbackEndpoints();
app.MapPairEndpoints();
app.MapSignalRWebhookEndpoints();
app.MapSignalRNegotiateEndpoints();
app.MapExcelEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapDevAuthEndpoints();
    app.MapDevNotificationsEndpoints();
    app.MapDevSeedEndpoints();
}

app.Run();

// Exposed for WebApplicationFactory<Program> integration tests.
public partial class Program;
