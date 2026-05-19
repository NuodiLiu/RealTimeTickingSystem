using Tickets.Domain.Devices;

namespace Tickets.Application.Pairing.Abstractions;

/// <summary>
/// Produces the (plaintext, hash) pair for a fresh device credential. The
/// plaintext is returned to the device exactly once via the pairing response
/// (api-pair.md pitfall #3); the hash is what we persist on
/// <see cref="KioskDevice.SecretHash"/>.
/// </summary>
public interface IDeviceSecretGenerator
{
    DeviceSecret Generate();
}

/// <summary>
/// Pair of plaintext device secret and the sha256 hash that goes into
/// <see cref="KioskDevice.SecretHash"/>.
/// </summary>
public readonly record struct DeviceSecret(string Plaintext, SecretHash Hash);
