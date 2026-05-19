using System.Globalization;
using System.Text;
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
                Encoding.UTF8.GetBytes(string.IsNullOrEmpty(jwtOptions.SigningKey)
                    ? new string('x', 64)
                    : jwtOptions.SigningKey)),
            NameClaimType = "sub",
            RoleClaimType = "role",
        };
    })
    .AddScheme<DeviceAuthSchemeOptions, DeviceAuthSchemeHandler>(
        DeviceAuthSchemeDefaults.Scheme, _ => { });
builder.Services.AddAuthorization();

// Webhook signature options (Azure SignalR upstream verification).
builder.Services
    .AddOptions<WebhookSignatureOptions>()
    .Bind(builder.Configuration.GetSection(WebhookSignatureOptions.SectionName));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseMiddleware<ErrorHandlingMiddleware>();

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
app.MapExcelEndpoints();

app.Run();

// Exposed for WebApplicationFactory<Program> integration tests.
public partial class Program;
