using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Events;
using Tickets.Domain.Staff;

namespace Tickets.Domain.FeedbackSessions.Events;

public sealed record FeedbackSessionCreated(
    FeedbackSessionId SessionId,
    CaseId CaseId,
    StaffId StaffId,
    DeviceId DeviceId,
    DateTimeOffset ExpireAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
