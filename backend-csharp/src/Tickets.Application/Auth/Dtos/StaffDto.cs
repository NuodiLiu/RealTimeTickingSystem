using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Dtos;

/// <summary>
/// HTTP-facing snapshot of a <see cref="Staff"/> record. Field naming mirrors
/// the legacy <c>GET /auth/me</c> response so the frontend can migrate without
/// schema churn (see api-auth.md §3).
/// </summary>
public sealed record StaffDto(
    Guid Id,
    string Role,
    string EmployeeNo,
    string IdentityKey,
    string? Name,
    string? Email)
{
    public static StaffDto From(Staff staff)
    {
        ArgumentNullException.ThrowIfNull(staff);
        return new StaffDto(
            Id: staff.Id.Value,
            Role: staff.Role.ToString(),
            EmployeeNo: staff.EmployeeNo.Value,
            IdentityKey: staff.IdentityKey.Value,
            Name: staff.Name,
            Email: staff.Email.Value);
    }
}
