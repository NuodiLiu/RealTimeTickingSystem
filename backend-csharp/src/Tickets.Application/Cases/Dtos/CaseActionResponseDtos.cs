namespace Tickets.Application.Cases.Dtos;

/// <summary>
/// Response for <c>POST /cases/{id}/take</c> and <c>POST /cases/take-next</c>.
/// The dashboard reads <c>{ case, message }</c> (frontend api.ts
/// <c>TakeCaseRes</c>; useQueue.ts checks <c>result.case</c> and shows
/// <c>result.message</c>). <see cref="Case"/> is <c>null</c> when take-next
/// found an empty queue.
/// </summary>
public sealed record TakeCaseResponseDto(CaseDto? Case, string Message);

/// <summary>
/// Response for <c>POST /cases/{id}/resolve</c> and
/// <c>POST /cases/{id}/escalate</c>. The dashboard reads <c>{ case }</c>
/// (frontend api.ts <c>ResolveCaseRes</c>), then reloads the queue.
/// </summary>
public sealed record CaseEnvelopeDto(CaseDto Case);
