using System.Security.Cryptography;
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

        Span<byte> hashBytes = stackalloc byte[SHA256.HashSizeInBytes];
        SHA256.HashData(plaintextBytes, hashBytes);
        var hashHex = Convert.ToHexString(hashBytes).ToLowerInvariant();

        return new DeviceSecret(plaintext, SecretHash.FromRaw(hashHex));
    }
}
