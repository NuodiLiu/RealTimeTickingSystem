namespace Tickets.Application.Pairing.Dtos;

/// <summary>
/// Returned exactly once at pairing completion. The plaintext device secret
/// CANNOT be recovered later (api-pair.md pitfall #3); the device must
/// persist <see cref="ApiKey"/> immediately.
/// </summary>
public sealed record CompletePairingDto(
    Guid DeviceId,
    string DeviceName,
    string Mode,
    string ApiKey,           // "{deviceId}:{plaintextSecret}" — legacy contract
    string WsToken,
    DateTimeOffset WsTokenExpireAt);
