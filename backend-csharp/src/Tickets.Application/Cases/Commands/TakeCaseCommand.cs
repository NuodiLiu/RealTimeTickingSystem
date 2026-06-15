namespace Tickets.Application.Cases.Commands;

/// <summary>
/// Staff manually takes a specific case (path: <c>POST /cases/{id}/take</c>).
/// Staff identity comes from <c>ICurrentUser</c>, not the command body.
/// </summary>
public sealed record TakeCaseCommand(Guid CaseId);
