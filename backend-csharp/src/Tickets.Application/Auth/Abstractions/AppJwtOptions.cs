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

    /// <summary>
    /// Audience for STAFF App-JWTs. The staff JwtBearer validation requires this
    /// audience exactly, so a device token (issued with <see cref="DeviceAudience"/>)
    /// is rejected by staff endpoints — closing the privilege-escalation hole
    /// where a device token could call staff routes.
    /// </summary>
    public string Audience { get; set; } = "tickets-api";

    /// <summary>
    /// Audience for DEVICE App-JWTs (the App-JWT an iPad presents as Bearer to
    /// <c>/api/signalr/negotiate</c>). Deliberately distinct from
    /// <see cref="Audience"/> so the staff JwtBearer scheme rejects it and the
    /// dedicated device JwtBearer scheme accepts it.
    /// </summary>
    public string DeviceAudience { get; set; } = "tickets-device";

    /// <summary>Base64-or-utf8 symmetric signing key. Min 32 bytes recommended.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public TimeSpan TokenTtl { get; set; } = TimeSpan.FromHours(2);
    public TimeSpan RefreshTtl { get; set; } = TimeSpan.FromDays(14);

    /// <summary>Lifetime of the device App-JWT minted by <c>POST /device/token</c>.</summary>
    public TimeSpan DeviceTokenTtl { get; set; } = TimeSpan.FromHours(12);
}
