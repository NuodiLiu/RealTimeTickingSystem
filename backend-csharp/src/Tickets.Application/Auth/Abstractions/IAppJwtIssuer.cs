using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Abstractions;

/// <summary>
/// Signs short-lived staff App-JWTs. Phase 4 implementation uses the symmetric
/// HS256 key from <see cref="AppJwtOptions"/>; Phase 5 may swap to Azure-AD-
/// brokered tokens.
/// </summary>
public interface IAppJwtIssuer
{
    AppJwt Issue(StaffId staffId, StaffRole role);
}

public sealed record AppJwt(string Token, DateTimeOffset ExpireAt);
