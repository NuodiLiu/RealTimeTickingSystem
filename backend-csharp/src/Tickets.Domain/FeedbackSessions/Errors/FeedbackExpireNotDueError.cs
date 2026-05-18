using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.FeedbackSessions.Errors;

/// <summary>
/// Raised when <c>Expire</c> is called before the session's expiry deadline.
/// Only the background sweep job should ever reach this path; if user-facing
/// code triggers it, suspect clock skew or a logic bug.
/// </summary>
public sealed class FeedbackExpireNotDueError(
    FeedbackSessionId sessionId,
    DateTimeOffset expireAt,
    DateTimeOffset now)
    : DomainError(
        "feedback_expire_not_due",
        $"Feedback session {sessionId} does not expire until {expireAt:O} (now is {now:O}).")
{
    public FeedbackSessionId SessionId { get; } = sessionId;
    public DateTimeOffset ExpireAt { get; } = expireAt;
    public DateTimeOffset Now { get; } = now;
}
