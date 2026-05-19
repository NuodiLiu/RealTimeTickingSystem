using Tickets.Domain.Staff;

namespace Tickets.Domain.Cases;

/// <summary>
/// Shared filter set used by export queries. All fields are optional.
/// Defined in Domain rather than Application so <see cref="ICaseRepository"/>
/// can reference it without inverting the dependency direction.
/// </summary>
public sealed record CaseExportFilters(
    IReadOnlyList<CaseStatus>? Statuses = null,
    DateTimeOffset? StartDate = null,
    DateTimeOffset? EndDate = null,
    StaffId? StaffId = null,
    string? Category = null);
