using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.FeedbackSessions.Events;

public sealed record FeedbackSessionSubmitted(
    FeedbackSessionId SessionId,
    CaseId CaseId,
    DeviceId DeviceId,
    FeedbackRating Rating,
    FeedbackComment? Comment,
    DateTimeOffset SubmittedAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
