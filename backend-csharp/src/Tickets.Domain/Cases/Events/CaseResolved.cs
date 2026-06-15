using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Cases.Events;

public sealed record CaseResolved(
    CaseId CaseId,
    CaseResolutionReason Reason,
    DateTimeOffset ResolvedAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
