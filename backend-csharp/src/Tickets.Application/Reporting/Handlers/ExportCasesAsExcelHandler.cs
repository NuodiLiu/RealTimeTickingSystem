using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Reporting.Abstractions;
using Tickets.Application.Reporting.Dtos;
using Tickets.Application.Reporting.Queries;
using Tickets.Domain.Cases;

namespace Tickets.Application.Reporting.Handlers;

public sealed class ExportCasesAsExcelHandler(
    ICaseRepository cases,
    IExcelWorkbookGenerator generator,
    ICurrentUser currentUser)
{
    public const int MaxRows = 10_000;

    public async Task<Result<byte[]>> HandleAsync(
        ExportCasesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is null)
        {
            return Result<byte[]>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var rows = await cases
            .QueryForExportAsync(query.Filters, MaxRows, cancellationToken)
            .ConfigureAwait(false);

        var dtoRows = rows.Select(CaseExportRow.From).ToList();
        var bytes = generator.BuildCasesWorkbook(dtoRows);
        return Result<byte[]>.Success(bytes);
    }
}
