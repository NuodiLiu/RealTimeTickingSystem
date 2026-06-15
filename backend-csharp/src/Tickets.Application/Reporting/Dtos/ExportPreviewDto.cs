namespace Tickets.Application.Reporting.Dtos;

public sealed record ExportPreviewDto(
    int TotalRows,
    Dictionary<string, int> StatusBreakdown,
    Dictionary<string, int> CategoryBreakdown,
    DateTimeOffset? EarliestCreatedAt,
    DateTimeOffset? LatestCreatedAt);
