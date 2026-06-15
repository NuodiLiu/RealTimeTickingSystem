using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Tickets.Domain.Devices;

namespace Tickets.WebApi.Identity;

/// <summary>
/// Validates the legacy <c>Authorization: Device &lt;deviceId&gt;:&lt;secret&gt;</c>
/// header. Matches the contract of the Node backend so iPad clients don't
/// have to change (AGENTS.md §8).
/// <para>
/// Verifies via timing-safe comparison of the sha256-hex of the supplied
/// secret against the stored <see cref="KioskDevice.SecretHash"/>. Devices
/// with <c>PairingStatus.Unpaired</c> or a cleared secret (post-unpair) are
/// rejected.
/// </para>
/// </summary>
internal sealed class DeviceAuthSchemeHandler(
    IOptionsMonitor<DeviceAuthSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IKioskDeviceRepository devices)
    : AuthenticationHandler<DeviceAuthSchemeOptions>(options, logger, encoder)
{
    private const string HeaderPrefix = "Device ";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header) || !header.StartsWith(HeaderPrefix, StringComparison.Ordinal))
        {
            return AuthenticateResult.NoResult();
        }

        var payload = header.AsSpan(HeaderPrefix.Length).Trim();
        var separator = payload.IndexOf(':');
        if (separator <= 0 || separator == payload.Length - 1)
        {
            return AuthenticateResult.Fail("Invalid device credential format.");
        }

        var deviceIdStr = payload[..separator].ToString();
        var plaintextSecret = payload[(separator + 1)..].ToString();

        if (!Guid.TryParse(deviceIdStr, out var deviceGuid))
        {
            return AuthenticateResult.Fail("Invalid device id format.");
        }

        var deviceId = new DeviceId(deviceGuid);
        var device = await devices.FindByIdAsync(deviceId, Context.RequestAborted).ConfigureAwait(false);
        if (device is null || !device.IsPaired || device.SecretHash.IsCleared)
        {
            return AuthenticateResult.Fail("Unknown or unpaired device.");
        }

        if (!ConstantTimeMatches(plaintextSecret, device.SecretHash.Value))
        {
            return AuthenticateResult.Fail("Invalid device credentials.");
        }

        var claims = new[]
        {
            new Claim(DeviceAuthSchemeDefaults.DeviceIdClaim, deviceId.Value.ToString()),
            new Claim(ClaimTypes.NameIdentifier, deviceId.Value.ToString()),
            new Claim("mode", device.Mode.ToString()),
        };
        var identity = new ClaimsIdentity(claims, DeviceAuthSchemeDefaults.Scheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, DeviceAuthSchemeDefaults.Scheme);
        return AuthenticateResult.Success(ticket);
    }

    private static bool ConstantTimeMatches(string plaintext, string storedHashHex)
    {
        Span<byte> hashed = stackalloc byte[SHA256.HashSizeInBytes];
        SHA256.HashData(Encoding.UTF8.GetBytes(plaintext), hashed);
        var inputHex = Convert.ToHexString(hashed).ToLower(CultureInfo.InvariantCulture);

        if (inputHex.Length != storedHashHex.Length)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(inputHex),
            Encoding.UTF8.GetBytes(storedHashHex));
    }
}
