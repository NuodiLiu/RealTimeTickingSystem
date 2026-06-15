namespace Tickets.Application.Auth.Abstractions;

/// <summary>
/// Claim names + values that distinguish a STAFF App-JWT from a DEVICE App-JWT
/// on the wire. The <see cref="TokenUse"/> claim is the primary discriminator:
/// staff tokens omit it (or carry <see cref="StaffTokenUse"/>); device tokens
/// MUST carry <see cref="DeviceTokenUse"/>. Combined with a distinct audience
/// (<see cref="AppJwtOptions.DeviceAudience"/>) this prevents a device token
/// from ever being accepted as staff.
/// </summary>
public static class AppJwtClaims
{
    /// <summary>Claim type marking the intended consumer of the token.</summary>
    public const string TokenUse = "token_use";

    /// <summary>Value of <see cref="TokenUse"/> for staff/dashboard tokens.</summary>
    public const string StaffTokenUse = "staff";

    /// <summary>Value of <see cref="TokenUse"/> for device/kiosk tokens.</summary>
    public const string DeviceTokenUse = "device";

    /// <summary>Claim carrying the authenticated device id on a device App-JWT.</summary>
    public const string DeviceId = "device_id";

    /// <summary>Claim carrying the device's current mode on a device App-JWT.</summary>
    public const string Mode = "mode";
}
