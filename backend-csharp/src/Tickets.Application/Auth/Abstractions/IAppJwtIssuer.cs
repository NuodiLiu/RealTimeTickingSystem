using Tickets.Domain.Devices;
using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Abstractions;

/// <summary>
/// Signs short-lived App-JWTs. Phase 4 implementation uses the symmetric
/// HS256 key from <see cref="AppJwtOptions"/>; Phase 5 may swap to Azure-AD-
/// brokered tokens.
/// </summary>
public interface IAppJwtIssuer
{
    /// <summary>
    /// Mints a STAFF App-JWT: audience <see cref="AppJwtOptions.Audience"/>,
    /// <c>role</c> claim set, and <c>token_use=staff</c>.
    /// </summary>
    AppJwt Issue(StaffId staffId, StaffRole role);

    /// <summary>
    /// Mints a DEVICE App-JWT the iPad presents as Bearer to
    /// <c>/api/signalr/negotiate</c>. Audience is
    /// <see cref="AppJwtOptions.DeviceAudience"/>, it carries
    /// <c>token_use=device</c> + <c>device_id</c> + <c>mode</c>, and NO
    /// <c>role</c> claim — so the staff JwtBearer scheme rejects it.
    /// </summary>
    AppJwt IssueDeviceToken(DeviceId deviceId, DeviceMode mode);
}

public sealed record AppJwt(string Token, DateTimeOffset ExpireAt);
