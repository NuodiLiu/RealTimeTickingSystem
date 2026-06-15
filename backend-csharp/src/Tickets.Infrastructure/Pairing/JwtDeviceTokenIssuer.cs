using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;

namespace Tickets.Infrastructure.Pairing;

/// <summary>
/// Phase 5 <see cref="IDeviceTokenIssuer"/>: mints a real signed HS256 JWT a
/// paired device presents to the SignalR/WebSocket layer. Mirrors
/// <see cref="Identity.AppJwtIssuer"/> — same signing key
/// (<see cref="AppJwtOptions.SigningKey"/>), issuer, and audience, so the
/// JwtBearer middleware validates device tokens with the existing parameters.
/// <para>
/// Claims: <c>sub</c> = device id, <c>device_id</c> = device id, <c>mode</c> =
/// current device mode, plus <c>nbf</c>/<c>exp</c> (exp = now + ttl) and the
/// configured <c>iss</c>/<c>aud</c>. All time comes from the injected
/// <see cref="IClock"/>.
/// </para>
/// </summary>
internal sealed class JwtDeviceTokenIssuer(
    IOptions<AppJwtOptions> options,
    IClock clock) : IDeviceTokenIssuer
{
    private readonly AppJwtOptions _opts = options.Value;

    public string IssueWebsocketToken(DeviceId deviceId, DeviceMode mode, TimeSpan ttl)
    {
        if (string.IsNullOrEmpty(_opts.SigningKey))
        {
            throw new InvalidOperationException("AppJwt:SigningKey is not configured.");
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opts.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var nowUtc = clock.UtcNow.UtcDateTime;
        var expireAt = (clock.UtcNow + ttl).UtcDateTime;
        var deviceIdStr = deviceId.Value.ToString();

        var jwt = new JwtSecurityToken(
            issuer: _opts.Issuer,
            audience: _opts.Audience,
            claims: new[]
            {
                new Claim("sub", deviceIdStr),
                new Claim("device_id", deviceIdStr),
                new Claim("mode", mode.ToString()),
            },
            notBefore: nowUtc,
            expires: expireAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
}
