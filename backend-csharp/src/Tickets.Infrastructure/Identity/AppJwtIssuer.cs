using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Identity;

/// <summary>
/// Signs HS256 App-JWTs using <see cref="AppJwtOptions.SigningKey"/>. Symmetric
/// key works for Phase 4; Phase 5 may swap in Microsoft.Identity.Web to broker
/// real Azure AD tokens.
/// <para>
/// Staff tokens use <see cref="AppJwtOptions.Audience"/> + a <c>role</c> claim +
/// <c>token_use=staff</c>. Device tokens use the distinct
/// <see cref="AppJwtOptions.DeviceAudience"/> + <c>token_use=device</c> and NO
/// <c>role</c>, so the staff JwtBearer validation (which pins the staff audience)
/// rejects a device token — preventing privilege escalation.
/// </para>
/// </summary>
internal sealed class AppJwtIssuer(
    IOptions<AppJwtOptions> options,
    IClock clock) : IAppJwtIssuer
{
    private readonly AppJwtOptions _opts = options.Value;

    public AppJwt Issue(StaffId staffId, StaffRole role)
    {
        var expireAt = clock.UtcNow + _opts.TokenTtl;
        var token = Sign(
            audience: _opts.Audience,
            claims: new[]
            {
                new Claim("sub", staffId.Value.ToString()),
                new Claim("role", role.ToString()),
                new Claim(AppJwtClaims.TokenUse, AppJwtClaims.StaffTokenUse),
            },
            expireAt);
        return new AppJwt(token, expireAt);
    }

    public AppJwt IssueDeviceToken(DeviceId deviceId, DeviceMode mode)
    {
        var deviceIdStr = deviceId.Value.ToString();
        var expireAt = clock.UtcNow + _opts.DeviceTokenTtl;
        var token = Sign(
            audience: _opts.DeviceAudience,
            claims: new[]
            {
                new Claim("sub", deviceIdStr),
                new Claim(AppJwtClaims.DeviceId, deviceIdStr),
                new Claim(AppJwtClaims.Mode, mode.ToString()),
                new Claim(AppJwtClaims.TokenUse, AppJwtClaims.DeviceTokenUse),
            },
            expireAt);
        return new AppJwt(token, expireAt);
    }

    private string Sign(string audience, Claim[] claims, DateTimeOffset expireAt)
    {
        if (string.IsNullOrEmpty(_opts.SigningKey))
        {
            throw new InvalidOperationException("AppJwt:SigningKey is not configured.");
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opts.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var nowUtc = clock.UtcNow.UtcDateTime;
        var jwt = new JwtSecurityToken(
            issuer: _opts.Issuer,
            audience: audience,
            claims: claims,
            notBefore: nowUtc,
            expires: expireAt.UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
}
