using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Reporting.Dtos;
using Tickets.Application.Reporting.Queries;
using Tickets.Domain.Cases;

namespace Tickets.Application.Reporting.Handlers;

public sealed class GetExportPreviewHandler(
    ICaseRepository cases,
    ICurrentUser currentUser)
{
    public const int MaxRows = 10_000;

    public async Task<Result<ExportPreviewDto>> HandleAsync(
        GetExportPreviewQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is null)
        {
            return Result<ExportPreviewDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var rows = await cases
            .QueryForExportAsync(query.Filters, MaxRows, cancellationToken)
            .ConfigureAwait(false);

        var statusBreakdown = rows
            .GroupBy(c => c.Status.ToString())
            .ToDictionary(g => g.Key, g => g.Count());
        var categoryBreakdown = rows
            .GroupBy(c => c.Category.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        DateTimeOffset? earliest = rows.Count > 0 ? rows.Min(c => c.CreatedAt) : null;
        DateTimeOffset? latest = rows.Count > 0 ? rows.Max(c => c.CreatedAt) : null;

        return Result<ExportPreviewDto>.Success(new ExportPreviewDto(
            TotalRows: rows.Count,
            StatusBreakdown: statusBreakdown,
            CategoryBreakdown: categoryBreakdown,
            EarliestCreatedAt: earliest,
            LatestCreatedAt: latest));
    }
}
