using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Events;
using Tickets.Domain.Staff;

namespace Tickets.Domain.Devices.Events;

public sealed record LockAcquired(
    DeviceId DeviceId,
    KioskLockId LockId,
    StaffId StaffId,
    CaseId CaseId,
    DateTimeOffset LeaseExpireAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
