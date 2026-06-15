using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Events;
using Tickets.Domain.Staff;

namespace Tickets.Domain.Devices.Events;

/// <summary>
/// Emitted when a staff member overrides the active lock by acquiring a new one
/// on the same device. Carries both old and new lock contexts so dashboards can
/// reflect the "case A was abandoned for case B" transition in one event.
/// </summary>
public sealed record LockOverridden(
    DeviceId DeviceId,
    KioskLockId OldLockId,
    CaseId OldCaseId,
    KioskLockId NewLockId,
    StaffId NewStaffId,
    CaseId NewCaseId,
    DateTimeOffset NewLeaseExpireAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
