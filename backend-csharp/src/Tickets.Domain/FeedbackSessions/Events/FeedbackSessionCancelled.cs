using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.FeedbackSessions.Events;

public sealed record FeedbackSessionCancelled(
    FeedbackSessionId SessionId,
    DateTimeOffset CancelledAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
