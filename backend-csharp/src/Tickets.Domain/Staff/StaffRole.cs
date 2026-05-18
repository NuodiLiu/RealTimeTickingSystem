namespace Tickets.Domain.Staff;

/// <summary>
/// Staff role hierarchy. Higher rank includes lower ranks (Admin can do what Staff can).
/// Defaults align with backend/src/services/staff.service.ts (default = Staff;
/// first Admin must be promoted via DB — see api-auth.md known pitfall #5).
/// </summary>
public enum StaffRole
{
    Staff = 1,
    Admin = 2,
}
