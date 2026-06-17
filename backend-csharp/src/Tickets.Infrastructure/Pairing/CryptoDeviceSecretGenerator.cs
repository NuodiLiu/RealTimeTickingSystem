using System.Security.Cryptography;
using System.Text;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Pairing;

internal sealed class CryptoDeviceSecretGenerator : IDeviceSecretGenerator
{
    public DeviceSecret Generate()
    {
        Span<byte> plaintextBytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(plaintextBytes);
        var plaintext = Convert.ToHexString(plaintextBytes).ToLowerInvariant();

        // Hash the UTF8 bytes of the hex *string* (the value the iPad echoes back
        // as the secret), NOT the raw 32 bytes. This MUST match the verifier in
        // DeviceAuthSchemeHandler.ConstantTimeMatches, which computes
        // sha256(UTF8(plaintext)). Hashing the raw bytes here made every device
        // auth (token/heartbeat/negotiate/createCase) fail with 401.
        Span<byte> hashBytes = stackalloc byte[SHA256.HashSizeInBytes];
        SHA256.HashData(Encoding.UTF8.GetBytes(plaintext), hashBytes);
        var hashHex = Convert.ToHexString(hashBytes).ToLowerInvariant();

        return new DeviceSecret(plaintext, SecretHash.FromRaw(hashHex));
    }
}
