using Tickets.Domain.Staff;

namespace Tickets.Application.Abstractions;

/// <summary>
/// Ambient information about the staff member whose App JWT authenticated the
/// current HTTP request. Bound in WebApi by the JWT auth middleware; null when
/// the call is anonymous or device-authenticated.
/// </summary>
public interface ICurrentUser
{
    StaffId? StaffId { get; }
    StaffRole? Role { get; }
}
