namespace Tickets.Domain.Cases;

/// <summary>
/// Workflow state of a <see cref="Case"/>. See AGENTS.md §4.1 for the full
/// state diagram. Mapping from the legacy Node enum:
/// <list type="bullet">
///   <item><c>QUEUED</c> → <see cref="Queued"/></item>
///   <item><c>IN_PROGRESS</c> → <see cref="InProgress"/></item>
///   <item><c>RESOLVED_PENDING_FEEDBACK</c> → <see cref="PendingFeedback"/></item>
///   <item><c>RESOLVED</c> → <see cref="Resolved"/></item>
/// </list>
/// </summary>
public enum CaseStatus
{
    Queued,
    InProgress,
    PendingFeedback,
    Resolved,
}
