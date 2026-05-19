using Tickets.Application.Reporting.Handlers;
using Tickets.Application.Reporting.Queries;
using Tickets.Domain.Cases;
using Tickets.Domain.Staff;
using Tickets.WebApi.Common;

namespace Tickets.WebApi.Endpoints;

public static class ExcelEndpoints
{
    public static IEndpointRouteBuilder MapExcelEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/excel").WithTags("Excel");

        group.MapGet("/preview", async (
            GetExportPreviewHandler handler,
            CaseStatus? status,
            DateTimeOffset? startDate,
            DateTimeOffset? endDate,
            Guid? staffId,
            string? category,
            CancellationToken ct) =>
        {
            var filters = BuildFilters(status, startDate, endDate, staffId, category);
            return (await handler.HandleAsync(new GetExportPreviewQuery(filters), ct))
                .ToHttpResult();
        }).RequireAuthorization();

        group.MapGet("/cases/json", async (
            ExportCasesAsJsonHandler handler,
            CaseStatus? status,
            DateTimeOffset? startDate,
            DateTimeOffset? endDate,
            Guid? staffId,
            string? category,
            CancellationToken ct) =>
        {
            var filters = BuildFilters(status, startDate, endDate, staffId, category);
            return (await handler.HandleAsync(new ExportCasesQuery(filters), ct))
                .ToHttpResult();
        }).RequireAuthorization();

        // Two aliases pointing at the same xlsx handler (legacy contract).
        var xlsxHandler = async (
            ExportCasesAsExcelHandler handler,
            CaseStatus? status,
            DateTimeOffset? startDate,
            DateTimeOffset? endDate,
            Guid? staffId,
            string? category,
            CancellationToken ct) =>
        {
            var filters = BuildFilters(status, startDate, endDate, staffId, category);
            var result = await handler.HandleAsync(new ExportCasesQuery(filters), ct);
            if (!result.IsSuccess)
            {
                return result.ToHttpResult();
            }
            return Results.File(
                result.Value!,
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileDownloadName: $"cases-{DateTime.UtcNow:yyyyMMdd-HHmmss}.xlsx");
        };
        group.MapGet("/cases", xlsxHandler).RequireAuthorization();
        group.MapGet("/cases/xlsx", xlsxHandler).RequireAuthorization();

        return app;
    }

    private static CaseExportFilters BuildFilters(
        CaseStatus? status,
        DateTimeOffset? startDate,
        DateTimeOffset? endDate,
        Guid? staffId,
        string? category) =>
        new(
            Statuses: status is { } s ? new[] { s } : null,
            StartDate: startDate,
            EndDate: endDate,
            StaffId: staffId is { } g ? new StaffId(g) : null,
            Category: category);
}
