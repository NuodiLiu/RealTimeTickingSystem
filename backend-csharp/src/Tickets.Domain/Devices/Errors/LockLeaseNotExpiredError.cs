using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when <c>ExpireLock</c> is called before the current lock's lease has
/// actually elapsed. Only the background cleanup job should ever reach this
/// path; reaching it from user-driven flows indicates a clock skew or logic bug.
/// </summary>
public sealed class LockLeaseNotExpiredError(
    DeviceId deviceId,
    KioskLockId lockId,
    DateTimeOffset leaseExpireAt,
    DateTimeOffset now)
    : DomainError(
        "lock_lease_active",
        $"Lock {lockId} on device {deviceId} does not expire until {leaseExpireAt:O} (now is {now:O}).")
{
    public DeviceId DeviceId { get; } = deviceId;
    public KioskLockId LockId { get; } = lockId;
    public DateTimeOffset LeaseExpireAt { get; } = leaseExpireAt;
    public DateTimeOffset Now { get; } = now;
}
