using Tickets.Domain.Cases;

namespace Tickets.Application.Cases.Dtos;

/// <summary>
/// HTTP-facing snapshot of a <see cref="Case"/>. Names mirror the legacy Node
/// API so frontend / iPad clients can migrate without DTO changes.
/// </summary>
public sealed record CaseDto(
    Guid Id,
    string StudentName,
    string Category,
    string? ZId,
    string Status,
    Guid? StaffId,
    Guid? CreatedByDeviceId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? ResolvedAt,
    string? EscalatedTo,
    bool? ResolvedOnSite)
{
    public static CaseDto From(Case theCase)
    {
        ArgumentNullException.ThrowIfNull(theCase);
        return new CaseDto(
            Id: theCase.Id.Value,
            StudentName: theCase.StudentName.Value,
            Category: theCase.Category.Value,
            ZId: theCase.ZId?.Value,
            Status: theCase.Status.ToString(),
            StaffId: theCase.AssignedStaffId?.Value,
            CreatedByDeviceId: theCase.CreatedByDeviceId?.Value,
            CreatedAt: theCase.CreatedAt,
            StartedAt: theCase.StartedAt,
            ResolvedAt: theCase.ResolvedAt,
            EscalatedTo: theCase.EscalatedTo,
            ResolvedOnSite: theCase.ResolvedOnSite);
    }
}
