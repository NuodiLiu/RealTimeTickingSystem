using Tickets.Domain.Devices;

namespace Tickets.Application.Pairing.Dtos;

/// <summary>
/// Returned exactly once at pairing completion. The plaintext device secret
/// CANNOT be recovered later (api-pair.md pitfall #3); the device must
/// persist the credentials immediately.
/// <para>
/// The iPad's <c>PairCompleteResponse</c> Codable decodes EXACTLY
/// <c>{ deviceId, deviceSecret, apiKey, deviceName, mode }</c> (see
/// <c>KioskApp/.../DTOs.swift</c>) and FAILS if any are missing — so
/// <see cref="DeviceSecret"/> is mandatory. <see cref="ApiKey"/> is
/// <c>"{deviceId}:{plaintextSecret}"</c>, which the iPad sends back as the
/// <c>Authorization: Device …</c> header.
/// </para>
/// <para>
/// <see cref="Mode"/> is the domain enum; the registered
/// <see cref="Tickets.Application.Common.Json.DeviceModeJsonConverter"/> emits
/// REGISTRATION / FEEDBACK — the iPad's <c>PairCompleteResponse.mode</c>
/// decodes <c>DeviceMode</c> and rejects the PascalCase ToString().
/// </para>
/// <para>
/// <see cref="WsEndpoint"/> mirrors the frontend's <c>PairCompleteRes.wsEndpoint</c>;
/// <see cref="WsToken"/> / <see cref="WsTokenExpireAt"/> remain for the legacy
/// websocket-token contract (the iPad now prefers <c>POST /device/token</c>).
/// </para>
/// </summary>
public sealed record CompletePairingDto(
    Guid DeviceId,
    string DeviceSecret,     // plaintext secret — returned once, never recoverable
    string DeviceName,
    DeviceMode Mode,
    string ApiKey,           // "{deviceId}:{plaintextSecret}" — legacy contract
    string WsToken,
    string WsEndpoint,
    DateTimeOffset WsTokenExpireAt);
