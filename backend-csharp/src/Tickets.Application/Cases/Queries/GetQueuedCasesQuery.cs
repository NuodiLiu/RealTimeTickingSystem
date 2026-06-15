using Tickets.Domain.Cases;

namespace Tickets.Application.Cases.Queries;

/// <summary>
/// Staff-facing listing. Adds pagination (api-cases.md pitfall #12) — page
/// is 1-based.
/// </summary>
public sealed record GetQueuedCasesQuery(
    CaseStatus Status = CaseStatus.Queued,
    int Page = 1,
    int PageSize = 50);
