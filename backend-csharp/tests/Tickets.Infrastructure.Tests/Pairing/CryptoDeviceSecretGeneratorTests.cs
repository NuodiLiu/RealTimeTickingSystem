using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Tickets.Infrastructure.Pairing;

namespace Tickets.Infrastructure.Tests.Pairing;

/// <summary>
/// Pins <see cref="CryptoDeviceSecretGenerator"/> to the SAME hashing convention
/// the device-auth verifier uses
/// (<c>DeviceAuthSchemeHandler.ConstantTimeMatches</c>): the stored hash MUST be
/// <c>sha256hex_lower( UTF8( plaintext ) )</c> of the plaintext the iPad echoes
/// back — NOT a hash of the raw random bytes.
/// <para>
/// Regression guard: the generator previously hashed the raw 32 bytes while the
/// verifier hashed UTF8(plaintext-hex-string). They never matched, so every
/// device auth (token/heartbeat/negotiate/createCase) failed with 401. CI stayed
/// green only because the integration test factory minted hashes the correct way,
/// bypassing this generator.
/// </para>
/// </summary>
public sealed class CryptoDeviceSecretGeneratorTests
{
    /// <summary>Mirrors DeviceAuthSchemeHandler.ConstantTimeMatches exactly.</summary>
    private static string VerifierHash(string plaintext)
    {
        Span<byte> hashed = stackalloc byte[SHA256.HashSizeInBytes];
        SHA256.HashData(Encoding.UTF8.GetBytes(plaintext), hashed);
        return Convert.ToHexString(hashed).ToLower(CultureInfo.InvariantCulture);
    }

    [Fact]
    public void Generate_StoredHash_MatchesVerifierConvention()
    {
        var generator = new CryptoDeviceSecretGenerator();

        var secret = generator.Generate();

        secret.Hash.Value.Should().Be(
            VerifierHash(secret.Plaintext),
            "the verifier recomputes sha256(UTF8(plaintext)); a mismatch here 401s every device request");
        secret.Hash.IsCleared.Should().BeFalse();
    }

    [Fact]
    public void Generate_Plaintext_Is64LowercaseHexChars()
    {
        var generator = new CryptoDeviceSecretGenerator();

        var secret = generator.Generate();

        secret.Plaintext.Should().MatchRegex("^[0-9a-f]{64}$");
    }

    [Fact]
    public void Generate_ProducesUniqueSecrets()
    {
        var generator = new CryptoDeviceSecretGenerator();

        var first = generator.Generate();
        var second = generator.Generate();

        second.Plaintext.Should().NotBe(first.Plaintext);
        second.Hash.Value.Should().NotBe(first.Hash.Value);
    }
}
