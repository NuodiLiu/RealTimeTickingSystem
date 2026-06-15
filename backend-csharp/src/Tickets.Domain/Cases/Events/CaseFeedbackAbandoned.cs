using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Cases.Events;

/// <summary>
/// Pending-feedback case was rolled back to <see cref="CaseStatus.InProgress"/>
/// (e.g. staff cancelled the feedback request but wants to keep working).
/// </summary>
public sealed record CaseFeedbackAbandoned(
    CaseId CaseId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
