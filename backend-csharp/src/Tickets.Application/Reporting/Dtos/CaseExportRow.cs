using Tickets.Domain.Cases;

namespace Tickets.Application.Reporting.Dtos;

/// <summary>
/// Flat row used by the Excel exporter and the JSON export response.
/// Phase 4 keeps it case-only; future phases may join staff name + feedback
/// rating by batching extra queries.
/// </summary>
public sealed record CaseExportRow(
    Guid Id,
    string? ZId,
    string StudentName,
    string Category,
    string Status,
    Guid? AssignedStaffId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? ResolvedAt,
    string? EscalatedTo,
    bool? ResolvedOnSite,
    double? WaitingSeconds,
    double? ProcessingSeconds)
{
    public static CaseExportRow From(Case c)
    {
        ArgumentNullException.ThrowIfNull(c);
        double? waiting = c.StartedAt is { } started ? (started - c.CreatedAt).TotalSeconds : null;
        double? processing = (c.StartedAt is { } s2 && c.ResolvedAt is { } resolved)
            ? (resolved - s2).TotalSeconds : null;

        return new CaseExportRow(
            Id: c.Id.Value,
            ZId: c.ZId?.Value,
            StudentName: c.StudentName.Value,
            Category: c.Category.Value,
            Status: c.Status.ToString(),
            AssignedStaffId: c.AssignedStaffId?.Value,
            CreatedAt: c.CreatedAt,
            StartedAt: c.StartedAt,
            ResolvedAt: c.ResolvedAt,
            EscalatedTo: c.EscalatedTo,
            ResolvedOnSite: c.ResolvedOnSite,
            WaitingSeconds: waiting,
            ProcessingSeconds: processing);
    }
}
