using Tickets.Domain.Cases.Events;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Aggregates;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;

namespace Tickets.Domain.Cases;

/// <summary>
/// Aggregate root for a customer-service case. Drives the main workflow state
/// machine — see AGENTS.md §4.1 for the diagram. All transitions go through
/// methods on this class; <see cref="Status"/> is never set from outside.
/// <para>
/// Mapped pitfalls (fully fixed by this aggregate):
/// <list type="bullet">
///   <item>api-cases.md #5 — <see cref="ResolveDirectly"/> on a Resolved case
///         now throws instead of silently overwriting <see cref="ResolvedAt"/>.</item>
///   <item>api-cases.md #7 — <see cref="CreatedByDeviceId"/> tracks the
///         originating kiosk for audit / dashboard.</item>
///   <item>api-cases.md #15 — distinct resolution methods + reason enum let the
///         Application layer return precise error messages
///         ("not in queue" vs "already taken").</item>
/// </list>
/// </para>
/// </summary>
public sealed class Case : AggregateRoot
{
    public CaseId Id { get; }
    public StudentName StudentName { get; }
    public Category Category { get; }
    public ZId? ZId { get; }
    public DeviceId? CreatedByDeviceId { get; }
    public DateTimeOffset CreatedAt { get; }

    public CaseStatus Status { get; private set; }
    public StaffId? AssignedStaffId { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? ResolvedAt { get; private set; }

    public string? EscalatedTo { get; private set; }
    public bool? ResolvedOnSite { get; private set; }
    public DateTimeOffset? EscalatedAt { get; private set; }

    private Case(
        CaseId id,
        StudentName studentName,
        Category category,
        ZId? zid,
        DeviceId? createdByDeviceId,
        DateTimeOffset createdAt,
        CaseStatus status)
    {
        Id = id;
        StudentName = studentName;
        Category = category;
        ZId = zid;
        CreatedByDeviceId = createdByDeviceId;
        CreatedAt = createdAt;
        Status = status;
    }

    // ───── Creation ──────────────────────────────────────────────────────

    /// <summary>Creates a new case in <see cref="CaseStatus.Queued"/>.</summary>
    public static Case Queue(
        StudentName studentName,
        Category category,
        ZId? zId,
        DeviceId? createdByDeviceId,
        IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        var theCase = new Case(
            id: CaseId.New(),
            studentName: studentName,
            category: category,
            zid: zId,
            createdByDeviceId: createdByDeviceId,
            createdAt: clock.UtcNow,
            status: CaseStatus.Queued);

        theCase.BumpVersion();
        theCase.RaiseEvent(new CaseQueued(
            theCase.Id, studentName, category, zId, createdByDeviceId, clock.UtcNow));

        return theCase;
    }

    // ───── Queued → InProgress ──────────────────────────────────────────

    public void Take(StaffId staff, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(CaseStatus.Queued, nameof(Take));

        Status = CaseStatus.InProgress;
        AssignedStaffId = staff;
        StartedAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new CaseTaken(Id, staff, StartedAt.Value, clock.UtcNow));
    }

    // ───── InProgress branching ─────────────────────────────────────────

    /// <summary>Move into the feedback flow without resolving yet.</summary>
    public void RequestFeedback(
        DeviceId deviceId,
        KioskLockId lockId,
        FeedbackSessionId sessionId,
        IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(CaseStatus.InProgress, nameof(RequestFeedback));

        Status = CaseStatus.PendingFeedback;
        BumpVersion();
        RaiseEvent(new CaseFeedbackRequested(Id, deviceId, lockId, sessionId, clock.UtcNow));
    }

    /// <summary>Resolve without going through feedback.</summary>
    public void ResolveDirectly(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(CaseStatus.InProgress, nameof(ResolveDirectly));
        ResolveInternal(CaseResolutionReason.ResolvedDirectly, clock);
    }

    // ───── PendingFeedback → Resolved (5 reasons) ────────────────────────

    /// <summary>Customer submitted feedback through the kiosk.</summary>
    public void SubmitFeedback(IClock clock) =>
        ResolveFromPending(CaseResolutionReason.FeedbackSubmitted, clock, nameof(SubmitFeedback));

    /// <summary>Staff force-resolved the case while feedback was pending.</summary>
    public void ForceResolve(IClock clock) =>
        ResolveFromPending(CaseResolutionReason.StaffForceResolved, clock, nameof(ForceResolve));

    /// <summary>The active lock was overridden by another case on the device.</summary>
    public void FeedbackOverridden(IClock clock) =>
        ResolveFromPending(CaseResolutionReason.FeedbackOverridden, clock, nameof(FeedbackOverridden));

    /// <summary>The 5-minute feedback timer elapsed without submission.</summary>
    public void FeedbackExpired(IClock clock) =>
        ResolveFromPending(CaseResolutionReason.FeedbackExpired, clock, nameof(FeedbackExpired));

    /// <summary>
    /// Background cleanup released the case after the configured disconnect
    /// grace period (default 5 minutes). Replaces the Node "instant resolve on
    /// disconnect" behaviour — see AGENTS.md §8.1 + api-signalr.md pitfall #4.
    /// </summary>
    public void DeviceLost(IClock clock) =>
        ResolveFromPending(CaseResolutionReason.DeviceLost, clock, nameof(DeviceLost));

    /// <summary>Rollback PendingFeedback → InProgress (e.g. staff cancels request).</summary>
    public void AbandonFeedbackSession(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(CaseStatus.PendingFeedback, nameof(AbandonFeedbackSession));

        Status = CaseStatus.InProgress;
        BumpVersion();
        RaiseEvent(new CaseFeedbackAbandoned(Id, clock.UtcNow));
    }

    // ───── Escalation (orthogonal to state machine) ──────────────────────

    /// <summary>
    /// Records that the case has been escalated to a department. Allowed only
    /// in <see cref="CaseStatus.InProgress"/> or <see cref="CaseStatus.PendingFeedback"/>.
    /// Does NOT change <see cref="Status"/>; if <paramref name="resolvedOnSite"/>
    /// is <c>true</c>, the Application layer must follow up with the appropriate
    /// resolution call in the same transaction.
    /// </summary>
    public void Escalate(string department, bool? resolvedOnSite, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        ArgumentException.ThrowIfNullOrWhiteSpace(department);
        if (Status is not (CaseStatus.InProgress or CaseStatus.PendingFeedback))
        {
            throw new InvalidStateTransitionError(nameof(Case), Status.ToString(), nameof(Escalate));
        }

        EscalatedTo = department.Trim();
        ResolvedOnSite = resolvedOnSite;
        EscalatedAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new CaseEscalated(
            Id, EscalatedTo, resolvedOnSite, EscalatedAt.Value, clock.UtcNow));
    }

    // ───── Helpers ───────────────────────────────────────────────────────

    private void ResolveFromPending(CaseResolutionReason reason, IClock clock, string operation)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsureStatus(CaseStatus.PendingFeedback, operation);
        ResolveInternal(reason, clock);
    }

    private void ResolveInternal(CaseResolutionReason reason, IClock clock)
    {
        Status = CaseStatus.Resolved;
        ResolvedAt = clock.UtcNow;
        BumpVersion();
        RaiseEvent(new CaseResolved(Id, reason, ResolvedAt.Value, clock.UtcNow));
    }

    private void EnsureStatus(CaseStatus required, string operation)
    {
        if (Status != required)
        {
            throw new InvalidStateTransitionError(nameof(Case), Status.ToString(), operation);
        }
    }
}
