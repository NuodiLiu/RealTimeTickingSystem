using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

public sealed record LockCompleted(
    DeviceId DeviceId,
    KioskLockId LockId,
    CaseId CaseId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
