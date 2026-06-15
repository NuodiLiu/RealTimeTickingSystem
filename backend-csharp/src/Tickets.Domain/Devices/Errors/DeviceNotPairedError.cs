using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when an operation requires the device to be in
/// <see cref="PairingStatus.Paired"/> but it is currently
/// <see cref="PairingStatus.Unpaired"/>.
/// </summary>
public sealed class DeviceNotPairedError(DeviceId deviceId)
    : DomainError(
        "device_not_paired",
        $"Device {deviceId} is not paired; the requested operation is not allowed.")
{
    public DeviceId DeviceId { get; } = deviceId;
}
