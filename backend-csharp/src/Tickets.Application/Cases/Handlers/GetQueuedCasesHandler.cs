using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Dtos;
using Tickets.Application.Cases.Queries;
using Tickets.Application.Common;
using Tickets.Domain.Cases;

namespace Tickets.Application.Cases.Handlers;

/// <summary>
/// Staff listing of cases by status. Caps <see cref="GetQueuedCasesQuery.PageSize"/>
/// to prevent expensive history pulls (api-cases.md pitfall #12).
/// </summary>
public sealed class GetQueuedCasesHandler(
    ICaseRepository repository,
    ICurrentUser currentUser)
{
    private const int MaxPageSize = 200;

    public async Task<Result<IReadOnlyList<CaseDto>>> HandleAsync(
        GetQueuedCasesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is null)
        {
            return Result<IReadOnlyList<CaseDto>>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        if (query.Page < 1)
        {
            return Result<IReadOnlyList<CaseDto>>.Failure(
                AppError.Validation("page must be >= 1."));
        }
        if (query.PageSize is < 1 or > MaxPageSize)
        {
            return Result<IReadOnlyList<CaseDto>>.Failure(
                AppError.Validation($"pageSize must be in [1, {MaxPageSize}]."));
        }

        var skip = (query.Page - 1) * query.PageSize;
        var rows = await repository
            .ListByStatusAsync(query.Status, skip, query.PageSize, cancellationToken)
            .ConfigureAwait(false);

        var dtos = rows.Select(CaseDto.From).ToList();
        return Result<IReadOnlyList<CaseDto>>.Success(dtos);
    }
}
