using System.Security.Cryptography;
using Tickets.Application.Pairing.Abstractions;

namespace Tickets.Infrastructure.Pairing;

internal sealed class CryptoPairingTokenGenerator : IPairingTokenGenerator
{
    public string Generate()
    {
        // 32 bytes of CSPRNG, hex-encoded — matches legacy Node behaviour.
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
