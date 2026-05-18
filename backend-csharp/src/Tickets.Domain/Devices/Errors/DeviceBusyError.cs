using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when an operation requires the device to be Idle (no active lock) but
/// it is currently Busy. Mirrors the <c>code: 'busy'</c> response shape produced
/// by the Node backend (feedback.send / device.changeMode / device.unpair).
/// </summary>
public sealed class DeviceBusyError(DeviceId deviceId, KioskLockId activeLockId)
    : DomainError(
        "busy",
        $"Device {deviceId} is busy with lock {activeLockId}.")
{
    public DeviceId DeviceId { get; } = deviceId;
    public KioskLockId ActiveLockId { get; } = activeLockId;
}
