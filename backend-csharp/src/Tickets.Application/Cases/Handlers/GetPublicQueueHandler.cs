using Tickets.Application.Cases.Dtos;
using Tickets.Application.Cases.Queries;
using Tickets.Application.Common;
using Tickets.Domain.Cases;

namespace Tickets.Application.Cases.Handlers;

/// <summary>
/// Returns the FIFO queue of <see cref="CaseStatus.Queued"/> cases for the
/// public display board. No-auth — but the result is capped to prevent the
/// legacy "pull-all-rows" anti-pattern (api-cases.md pitfall #11).
/// </summary>
public sealed class GetPublicQueueHandler(ICaseRepository repository)
{
    public async Task<Result<IReadOnlyList<PublicQueueEntryDto>>> HandleAsync(
        GetPublicQueueQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        if (query.MaxResults <= 0 || query.MaxResults > 200)
        {
            return Result<IReadOnlyList<PublicQueueEntryDto>>.Failure(
                AppError.Validation("maxResults must be in [1, 200]."));
        }

        var rows = await repository
            .ListByStatusAsync(CaseStatus.Queued, skip: 0, take: query.MaxResults, cancellationToken)
            .ConfigureAwait(false);

        var dtos = new List<PublicQueueEntryDto>(rows.Count);
        for (var i = 0; i < rows.Count; i++)
        {
            var c = rows[i];
            dtos.Add(new PublicQueueEntryDto(
                Id: c.Id.Value,
                StudentName: c.StudentName.Value,
                Position: i + 1,
                CreatedAt: c.CreatedAt,
                Status: c.Status));
        }

        return Result<IReadOnlyList<PublicQueueEntryDto>>.Success(dtos);
    }
}
