namespace Tickets.WebApi.Identity;

public static class DeviceAuthSchemeDefaults
{
    /// <summary>Authentication scheme name for the <c>Authorization: Device …</c> header.</summary>
    public const string Scheme = "Device";

    /// <summary>Claim type that carries the authenticated device id.</summary>
    public const string DeviceIdClaim = "device_id";
}
