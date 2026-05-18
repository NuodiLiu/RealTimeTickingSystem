using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

/// <summary>
/// Emitted by the background cleanup job when a lock's lease has elapsed.
/// </summary>
public sealed record LockExpired(
    DeviceId DeviceId,
    KioskLockId LockId,
    CaseId CaseId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
