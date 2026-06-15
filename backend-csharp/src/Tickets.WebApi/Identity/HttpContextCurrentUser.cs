using System.Security.Claims;
using Tickets.Application.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.WebApi.Identity;

/// <summary>
/// Resolves <see cref="ICurrentUser"/> from the active HTTP request's
/// <see cref="ClaimsPrincipal"/>. JWT bearer middleware populates the
/// principal; <c>sub</c> carries the StaffId and <c>role</c> the
/// <see cref="StaffRole"/>.
/// </summary>
internal sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public StaffId? StaffId
    {
        get
        {
            var sub = ReadClaim(ClaimTypes.NameIdentifier) ?? ReadClaim("sub");
            return Guid.TryParse(sub, out var g) ? new StaffId(g) : null;
        }
    }

    public StaffRole? Role
    {
        get
        {
            var raw = ReadClaim(ClaimTypes.Role) ?? ReadClaim("role");
            return Enum.TryParse<StaffRole>(raw, ignoreCase: true, out var r) ? r : null;
        }
    }

    private string? ReadClaim(string claimType) =>
        accessor.HttpContext?.User.FindFirst(claimType)?.Value;
}
