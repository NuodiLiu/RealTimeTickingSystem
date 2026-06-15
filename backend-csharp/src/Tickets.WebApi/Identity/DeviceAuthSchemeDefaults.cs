namespace Tickets.WebApi.Identity;

public static class DeviceAuthSchemeDefaults
{
    /// <summary>Authentication scheme name for the <c>Authorization: Device …</c> header.</summary>
    public const string Scheme = "Device";

    /// <summary>
    /// Authorization policy name that requires an authenticated principal on the
    /// <see cref="Scheme"/> scheme (used by device-only endpoints, e.g.
    /// <c>POST /cases</c>).
    /// </summary>
    public const string Policy = "DeviceOnly";

    /// <summary>Claim type that carries the authenticated device id.</summary>
    public const string DeviceIdClaim = "device_id";
}
