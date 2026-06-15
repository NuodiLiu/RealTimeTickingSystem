using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Tickets.Application;
using Tickets.Application.Abstractions;
using Tickets.Application.Auth.Abstractions;
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

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            NameClaimType = "sub",
            RoleClaimType = "role",
        };
    })
    .AddScheme<DeviceAuthSchemeOptions, DeviceAuthSchemeHandler>(
        DeviceAuthSchemeDefaults.Scheme, _ => { });
builder.Services.AddAuthorization(options =>
{
    options.AddSignalRNegotiatePolicy();
    // A6: device-only policy for POST /cases — only the Device auth scheme,
    // authenticated principal required (anonymous → 401, staff JWT → 403).
    options.AddPolicy(DeviceAuthSchemeDefaults.Policy, policy => policy
        .AddAuthenticationSchemes(DeviceAuthSchemeDefaults.Scheme)
        .RequireAuthenticatedUser());
});

// Webhook signature options (Azure SignalR upstream verification).
builder.Services
    .AddOptions<WebhookSignatureOptions>()
    .Bind(builder.Configuration.GetSection(WebhookSignatureOptions.SectionName));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Minimal-API JSON: camelCase property names to match the SignalR client
// contract and the rest of the API surface.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

// CORS — bound from "Cors:AllowedOrigins" config array. Frontend dev server
// uses cookies for refresh, so we need AllowCredentials + explicit origins
// (wildcard '*' is forbidden together with credentials).
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(p => p
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

var app = builder.Build();

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
