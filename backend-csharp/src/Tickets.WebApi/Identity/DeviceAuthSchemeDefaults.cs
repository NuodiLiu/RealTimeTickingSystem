namespace Tickets.WebApi.Identity;

public static class DeviceAuthSchemeDefaults
{
    /// <summary>Authentication scheme name for the <c>Authorization: Device …</c> header.</summary>
    public const string Scheme = "Device";

    /// <summary>
    /// JwtBearer scheme name for the DEVICE App-JWT (audience
    /// <c>tickets-device</c>, <c>token_use=device</c>). Distinct from the staff
    /// bearer scheme so a device App-JWT can negotiate SignalR but cannot pass
    /// the staff JwtBearer validation (different audience) on staff endpoints.
    /// </summary>
    public const string JwtScheme = "DeviceJwt";

    /// <summary>
    /// Authorization policy name that requires an authenticated principal on the
    /// <see cref="Scheme"/> scheme (used by device-only endpoints, e.g.
    /// <c>POST /cases</c>).
    /// </summary>
    public const string Policy = "DeviceOnly";

    /// <summary>Claim type that carries the authenticated device id.</summary>
    public const string DeviceIdClaim = "device_id";
}
