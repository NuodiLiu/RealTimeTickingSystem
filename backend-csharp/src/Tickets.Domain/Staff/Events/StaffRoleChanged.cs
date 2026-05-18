using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Staff.Events;

public sealed record StaffRoleChanged(
    StaffId StaffId,
    StaffRole From,
    StaffRole To,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
