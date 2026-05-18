using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Cases.Events;

/// <summary>
/// Carries device / lock / session context so SignalR notifications can be
/// produced without re-querying the database.
/// </summary>
public sealed record CaseFeedbackRequested(
    CaseId CaseId,
    DeviceId DeviceId,
    KioskLockId LockId,
    FeedbackSessionId SessionId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
