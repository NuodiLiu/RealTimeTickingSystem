namespace Tickets.Application.Cases.Commands;

/// <summary>
/// Staff resolves a case. The aggregate's current status decides the path:
/// <list type="bullet">
///   <item><c>InProgress</c>: <c>Case.ResolveDirectly</c>, no side effects.</item>
///   <item><c>PendingFeedback</c>: <c>Case.ForceResolve</c> + cancel the
///         active feedback session + complete the device lock.</item>
///   <item>any other state: <c>409 invalid_state_transition</c>.</item>
/// </list>
/// </summary>
public sealed record ResolveCaseCommand(Guid CaseId);
