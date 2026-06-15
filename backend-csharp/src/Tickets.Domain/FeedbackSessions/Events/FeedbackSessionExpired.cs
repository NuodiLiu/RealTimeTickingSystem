using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.FeedbackSessions.Events;

public sealed record FeedbackSessionExpired(
    FeedbackSessionId SessionId,
    DateTimeOffset ExpiredAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
