using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.FeedbackSessions.Events;

public sealed record FeedbackSessionDelivered(
    FeedbackSessionId SessionId,
    DateTimeOffset DeliveredAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
