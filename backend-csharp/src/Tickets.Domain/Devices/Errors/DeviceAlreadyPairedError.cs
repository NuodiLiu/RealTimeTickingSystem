using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when <c>RestorePairing</c> is called on a device that is already
/// paired (use <c>RotateSecret</c> for re-pairing an active device instead).
/// </summary>
public sealed class DeviceAlreadyPairedError(DeviceId deviceId)
    : DomainError(
        "device_already_paired",
        $"Device {deviceId} is already paired; call RotateSecret instead of RestorePairing.")
{
    public DeviceId DeviceId { get; } = deviceId;
}
