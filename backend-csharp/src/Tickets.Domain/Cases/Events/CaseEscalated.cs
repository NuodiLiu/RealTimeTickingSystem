using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Cases.Events;

/// <summary>
/// Escalation is orthogonal to the main state machine — this event records the
/// metadata change but the case status is unchanged. Application layer decides
/// whether to follow up with a separate resolution call when
/// <see cref="ResolvedOnSite"/> is <c>true</c>.
/// </summary>
public sealed record CaseEscalated(
    CaseId CaseId,
    string Department,
    bool? ResolvedOnSite,
    DateTimeOffset EscalatedAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
