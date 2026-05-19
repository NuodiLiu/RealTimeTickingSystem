using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Identity;

/// <summary>
/// Signs HS256 App-JWTs using <see cref="AppJwtOptions.SigningKey"/>. Symmetric
/// key works for Phase 4; Phase 5 may swap in Microsoft.Identity.Web to broker
/// real Azure AD tokens.
/// </summary>
internal sealed class AppJwtIssuer(
    IOptions<AppJwtOptions> options,
    IClock clock) : IAppJwtIssuer
{
    private readonly AppJwtOptions _opts = options.Value;

    public AppJwt Issue(StaffId staffId, StaffRole role)
    {
        if (string.IsNullOrEmpty(_opts.SigningKey))
        {
            throw new InvalidOperationException("AppJwt:SigningKey is not configured.");
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opts.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var nowUtc = clock.UtcNow.UtcDateTime;
        var expireAt = clock.UtcNow + _opts.TokenTtl;
        var jwt = new JwtSecurityToken(
            issuer: _opts.Issuer,
            audience: _opts.Audience,
            claims: new[]
            {
                new Claim("sub", staffId.Value.ToString()),
                new Claim("role", role.ToString()),
            },
            notBefore: nowUtc,
            expires: expireAt.UtcDateTime,
            signingCredentials: credentials);

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        return new AppJwt(token, expireAt);
    }
}
