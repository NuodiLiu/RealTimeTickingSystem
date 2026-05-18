using Tickets.Domain.Shared.Events;
using Tickets.Domain.Staff;

namespace Tickets.Domain.Cases.Events;

public sealed record CaseTaken(
    CaseId CaseId,
    StaffId StaffId,
    DateTimeOffset StartedAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
