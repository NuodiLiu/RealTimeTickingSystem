namespace Tickets.Application.Cases.Commands;

/// <summary>
/// Records that a case has been escalated to a department. Does not change
/// <c>CaseStatus</c>; if <see cref="ResolvedOnSite"/> is <c>true</c>, the
/// caller is expected to issue a separate resolve command in the same flow.
/// </summary>
public sealed record EscalateCaseCommand(
    Guid CaseId,
    string Department,
    bool? ResolvedOnSite);
