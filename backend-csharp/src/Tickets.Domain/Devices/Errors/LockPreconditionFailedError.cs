using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when a caller-supplied lockId / version pair does not match the
/// device's current lock. Mirrors the <c>code: 'precondition_failed'</c>
/// payload returned by the Node feedback.override flow, including the current
/// lock context so the client can refresh and retry.
/// </summary>
public sealed class LockPreconditionFailedError(
    DeviceId deviceId,
    KioskLockId expectedLockId,
    uint expectedVersion,
    KioskLockId actualLockId,
    uint actualVersion)
    : DomainError(
        "precondition_failed",
        $"Device {deviceId} lock changed: expected ({expectedLockId} v{expectedVersion}), " +
        $"actual ({actualLockId} v{actualVersion}).")
{
    public DeviceId DeviceId { get; } = deviceId;
    public KioskLockId ExpectedLockId { get; } = expectedLockId;
    public uint ExpectedVersion { get; } = expectedVersion;
    public KioskLockId ActualLockId { get; } = actualLockId;
    public uint ActualVersion { get; } = actualVersion;
}
