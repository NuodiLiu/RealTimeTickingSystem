using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.FeedbackSessions.Events;

public sealed record FeedbackSessionOverridden(
    FeedbackSessionId SessionId,
    DateTimeOffset OverriddenAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
