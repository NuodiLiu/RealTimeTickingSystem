using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions.Errors;
using Tickets.Domain.FeedbackSessions.Events;
using Tickets.Domain.Shared.Aggregates;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;

namespace Tickets.Domain.FeedbackSessions;

/// <summary>
/// Aggregate root for a customer-feedback collection cycle. See AGENTS.md §4.2
/// for the state diagram.
/// <para>
/// Cross-aggregate references (<see cref="CaseId"/>, <see cref="StaffId"/>,
/// <see cref="DeviceId"/>) are stored as IDs only — this aggregate never
/// touches a Case / Staff / Device instance.
/// </para>
/// <para>
/// Mapped pitfalls:
/// <list type="bullet">
///   <item>api-feedback.md #16 — device ownership enforcement happens in the
///         Application layer (it must check <see cref="DeviceId"/> against the
///         caller's authenticated device before calling <see cref="Submit"/>).</item>
///   <item>api-feedback.md #7 — duplicate <see cref="Submit"/> attempts now
///         throw <see cref="InvalidStateTransitionError"/> instead of silently
///         succeeding. App-level idempotency lives in the handler.</item>
/// </list>
/// </para>
/// </summary>
public sealed class FeedbackSession : AggregateRoot
{
    public FeedbackSessionId Id { get; }
    public CaseId CaseId { get; }
    public StaffId StaffId { get; }
    public DeviceId DeviceId { get; }
    public FeedbackSessionStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset ExpireAt { get; }
    public DateTimeOffset? DeliveredAt { get; private set; }
    public DateTimeOffset? SubmittedAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public DateTimeOffset? OverriddenAt { get; private set; }
    public DateTimeOffset? ExpiredAt { get; private set; }
    public FeedbackRating? Rating { get; private set; }
    public FeedbackComment? Comment { get; private set; }

    private FeedbackSession(
        FeedbackSessionId id,
        CaseId caseId,
        StaffId staffId,
        DeviceId deviceId,
        FeedbackSessionStatus status,
        DateTimeOffset createdAt,
        DateTimeOffset expireAt)
    {
        Id = id;
        CaseId = caseId;
        StaffId = staffId;
        DeviceId = deviceId;
        Status = status;
        CreatedAt = createdAt;
        ExpireAt = expireAt;
    }

    public static FeedbackSession Create(
        CaseId caseId,
        StaffId staffId,
        DeviceId deviceId,
        DateTimeOffset expireAt,
        IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        if (expireAt <= clock.UtcNow)
        {
            throw new ArgumentException(
                $"Expiration must be strictly in the future; expireAt={expireAt:O}, now={clock.UtcNow:O}.",
                nameof(expireAt));
        }

        var session = new FeedbackSession(
            id: FeedbackSessionId.New(),
            caseId: caseId,
            staffId: staffId,
            deviceId: deviceId,
            status: FeedbackSessionStatus.Created,
            createdAt: clock.UtcNow,
            expireAt: expireAt);

        session.BumpVersion();
        session.RaiseEvent(new FeedbackSessionCreated(
            session.Id, caseId, staffId, deviceId, expireAt, clock.UtcNow));

        return session;
    }

    // ───── Active lifecycle ──────────────────────────────────────────────

    /// <summary>iPad ACK that the show-feedback message rendered on screen.</summary>
    public void MarkDelivered(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(FeedbackSessionStatus.Created, nameof(MarkDelivered));

        Status = FeedbackSessionStatus.Delivered;
        DeliveredAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new FeedbackSessionDelivered(Id, DeliveredAt.Value, clock.UtcNow));
    }

    /// <summary>
    /// Customer submitted their rating + optional comment. Only allowed from
    /// Delivered — if iPad never ACK'd, Application layer must invoke
    /// MarkDelivered first within the same transaction.
    /// </summary>
    public void Submit(FeedbackRating rating, FeedbackComment? comment, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(FeedbackSessionStatus.Delivered, nameof(Submit));

        Status = FeedbackSessionStatus.Submitted;
        SubmittedAt = clock.UtcNow;
        Rating = rating;
        Comment = comment;
        BumpVersion();
        RaiseEvent(new FeedbackSessionSubmitted(
            Id, CaseId, DeviceId, rating, comment, SubmittedAt.Value, clock.UtcNow));
    }

    // ───── Termination paths ─────────────────────────────────────────────

    /// <summary>Staff force-resolved / cancelled the session.</summary>
    public void Cancel(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureActive(nameof(Cancel));

        Status = FeedbackSessionStatus.Cancelled;
        CancelledAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new FeedbackSessionCancelled(Id, CancelledAt.Value, clock.UtcNow));
    }

    /// <summary>Another lock acquired the device, abandoning this session.</summary>
    public void MarkOverridden(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureActive(nameof(MarkOverridden));

        Status = FeedbackSessionStatus.Overridden;
        OverriddenAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new FeedbackSessionOverridden(Id, OverriddenAt.Value, clock.UtcNow));
    }

    /// <summary>
    /// Background sweep job declares the session expired. Requires the clock
    /// to be at or after <see cref="ExpireAt"/>.
    /// </summary>
    public void Expire(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureActive(nameof(Expire));
        if (clock.UtcNow < ExpireAt)
        {
            throw new FeedbackExpireNotDueError(Id, ExpireAt, clock.UtcNow);
        }

        Status = FeedbackSessionStatus.Expired;
        ExpiredAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new FeedbackSessionExpired(Id, ExpiredAt.Value, clock.UtcNow));
    }

    // ───── Guards ────────────────────────────────────────────────────────

    private void EnsureStatus(FeedbackSessionStatus required, string operation)
    {
        if (Status != required)
        {
            throw new InvalidStateTransitionError(
                nameof(FeedbackSession), Status.ToString(), operation);
        }
    }

    private void EnsureActive(string operation)
    {
        if (Status is not (FeedbackSessionStatus.Created or FeedbackSessionStatus.Delivered))
        {
            throw new InvalidStateTransitionError(
                nameof(FeedbackSession), Status.ToString(), operation);
        }
    }
}
