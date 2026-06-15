using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Reporting.Dtos;
using Tickets.Application.Reporting.Queries;
using Tickets.Domain.Cases;

namespace Tickets.Application.Reporting.Handlers;

public sealed class ExportCasesAsJsonHandler(
    ICaseRepository cases,
    ICurrentUser currentUser)
{
    public const int MaxRows = 10_000;

    public async Task<Result<IReadOnlyList<CaseExportRow>>> HandleAsync(
        ExportCasesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is null)
        {
            return Result<IReadOnlyList<CaseExportRow>>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var rows = await cases
            .QueryForExportAsync(query.Filters, MaxRows, cancellationToken)
            .ConfigureAwait(false);
        var dtos = rows.Select(CaseExportRow.From).ToList();
        return Result<IReadOnlyList<CaseExportRow>>.Success(dtos);
    }
}
