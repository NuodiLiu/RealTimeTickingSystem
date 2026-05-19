namespace Tickets.WebApi.Identity;

/// <summary>
/// Bound from <c>appsettings.json</c> section <c>"AppJwt"</c>. In Phase 4 this
/// is a symmetric key issuer used to sign staff App-JWTs; Phase 5 swaps in
/// Microsoft.Identity.Web for real Azure AD validation.
/// </summary>
public sealed class AppJwtOptions
{
    public const string SectionName = "AppJwt";

    public string Issuer { get; set; } = "https://localhost/tickets";
    public string Audience { get; set; } = "tickets-api";

    /// <summary>
    /// Base64-encoded symmetric signing key (min 32 bytes). Provided through
    /// <c>appsettings.{Env}.json</c> or environment variable
    /// <c>AppJwt__SigningKey</c>.
    /// </summary>
    public string SigningKey { get; set; } = string.Empty;

    public TimeSpan TokenTtl { get; set; } = TimeSpan.FromHours(2);
}
