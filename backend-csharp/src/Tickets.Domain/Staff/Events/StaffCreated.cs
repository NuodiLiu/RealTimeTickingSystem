using Tickets.Domain.Shared.Events;
using Tickets.Domain.Shared.ValueObjects;

namespace Tickets.Domain.Staff.Events;

public sealed record StaffCreated(
    StaffId StaffId,
    IdentityKey IdentityKey,
    EmailAddress Email,
    EmployeeNo EmployeeNo,
    StaffRole Role,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
