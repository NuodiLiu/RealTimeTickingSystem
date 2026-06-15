using System.Security.Cryptography;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;

namespace Tickets.Infrastructure.Pairing;

/// <summary>
/// Placeholder issuer used in Phase 4: emits a 32-byte CSPRNG token plus a
/// <c>:{exp}</c> suffix so it has the shape of an opaque bearer token.
/// <para>
/// This is NOT cryptographically signed — clients receive it but the WebApi
/// cannot validate it without further work. Phase 5 will replace with a
/// proper JWT (HS256 against AppJwt:SigningKey).
/// </para>
/// </summary>
internal sealed class PlaceholderDeviceTokenIssuer(IClock clock) : IDeviceTokenIssuer
{
    public string IssueWebsocketToken(DeviceId deviceId, DeviceMode mode, TimeSpan ttl)
    {
        Span<byte> bytes = stackalloc byte[24];
        RandomNumberGenerator.Fill(bytes);
        var nonce = Convert.ToBase64String(bytes);
        var exp = (clock.UtcNow + ttl).ToUnixTimeSeconds();
        return $"{deviceId.Value:N}.{mode}.{exp}.{nonce}";
    }
}
