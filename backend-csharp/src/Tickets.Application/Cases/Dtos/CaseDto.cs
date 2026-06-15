using System.Text.Json.Serialization;
using Tickets.Domain.Cases;

namespace Tickets.Application.Cases.Dtos;

/// <summary>
/// HTTP-facing snapshot of a <see cref="Case"/>. Names mirror the legacy Node
/// API so frontend / iPad clients can migrate without DTO changes.
/// <para>
/// <see cref="Status"/> is the domain enum; the registered
/// <see cref="Tickets.Application.Common.Json.CaseStatusJsonConverter"/> emits
/// it as the legacy UPPER_SNAKE wire string (QUEUED / IN_PROGRESS /
/// RESOLVED_PENDING_FEEDBACK / RESOLVED).
/// </para>
/// </summary>
public sealed record CaseDto(
    Guid Id,
    string StudentName,
    string Category,
    // The clients spell this field "zID" (frontend CaseItem.zID, currentLock
    // case.zID); pin the JSON name so the default camelCase policy can't turn
    // it into "zId".
    [property: JsonPropertyName("zID")] string? ZId,
    CaseStatus Status,
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
            Status: theCase.Status,
            StaffId: theCase.AssignedStaffId?.Value,
            CreatedByDeviceId: theCase.CreatedByDeviceId?.Value,
            CreatedAt: theCase.CreatedAt,
            StartedAt: theCase.StartedAt,
            ResolvedAt: theCase.ResolvedAt,
            EscalatedTo: theCase.EscalatedTo,
            ResolvedOnSite: theCase.ResolvedOnSite);
    }
}
