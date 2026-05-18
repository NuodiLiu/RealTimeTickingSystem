using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when a lock operation (complete / override / expire) is attempted on
/// a device that has no current lock. Maps to <c>code: 'idle'</c> in the
/// existing API contract (api-feedback.md override flow).
/// </summary>
public sealed class LockNotActiveError(DeviceId deviceId)
    : DomainError(
        "idle",
        $"Device {deviceId} has no active lock.")
{
    public DeviceId DeviceId { get; } = deviceId;
}
