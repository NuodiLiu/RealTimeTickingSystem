using System.Security.Claims;
using Tickets.Application.Abstractions;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.WebApi.Identity;

/// <summary>
/// Resolves <see cref="ICurrentUser"/> from the active HTTP request's
/// <see cref="ClaimsPrincipal"/>. JWT bearer middleware populates the
/// principal; <c>sub</c> carries the StaffId and <c>role</c> the
/// <see cref="StaffRole"/>.
/// <para>
/// SECURITY: a DEVICE App-JWT also carries a <c>sub</c> (the device id). To stop
/// a device principal from being mis-read as staff (which previously caused the
/// negotiate PII leak), this adapter returns <c>null</c> whenever the principal
/// carries <c>token_use=device</c> or a <c>device_id</c> claim.
/// </para>
/// </summary>
internal sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public StaffId? StaffId
    {
        get
        {
            if (IsDevicePrincipal())
            {
                return null;
            }

            var sub = ReadClaim(ClaimTypes.NameIdentifier) ?? ReadClaim("sub");
            return Guid.TryParse(sub, out var g) ? new StaffId(g) : null;
        }
    }

    public StaffRole? Role
    {
        get
        {
            if (IsDevicePrincipal())
            {
                return null;
            }

            var raw = ReadClaim(ClaimTypes.Role) ?? ReadClaim("role");
            return Enum.TryParse<StaffRole>(raw, ignoreCase: true, out var r) ? r : null;
        }
    }

    private bool IsDevicePrincipal() =>
        string.Equals(
            ReadClaim(AppJwtClaims.TokenUse),
            AppJwtClaims.DeviceTokenUse,
            StringComparison.Ordinal)
        || ReadClaim(AppJwtClaims.DeviceId) is not null;

    private string? ReadClaim(string claimType) =>
        accessor.HttpContext?.User.FindFirst(claimType)?.Value;
}
