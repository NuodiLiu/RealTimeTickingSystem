namespace Tickets.Application.Auth.Abstractions;

/// <summary>
/// Configuration for staff App-JWT issuance and validation. Both
/// <c>IAppJwtIssuer</c> (Infrastructure) and the JwtBearer middleware
/// (WebApi) bind to the same section, so the signing key and audience
/// can't drift.
/// </summary>
public sealed class AppJwtOptions
{
    public const string SectionName = "AppJwt";

    public string Issuer { get; set; } = "https://localhost/tickets";
    public string Audience { get; set; } = "tickets-api";

    /// <summary>Base64-or-utf8 symmetric signing key. Min 32 bytes recommended.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public TimeSpan TokenTtl { get; set; } = TimeSpan.FromHours(2);
    public TimeSpan RefreshTtl { get; set; } = TimeSpan.FromDays(14);
}
