namespace Tickets.Application.Devices.Dtos;

/// <summary>
/// Response for <c>POST /device/token</c> (device-header auth). Matches the iOS
/// <c>DeviceJWTResponse</c> decoder exactly: <c>{ appJwt, expiresAt }</c>.
/// <para>
/// <c>appJwt</c> is the DEVICE App-JWT the iPad presents as <c>Bearer</c> to
/// <c>/api/signalr/negotiate</c>. <c>expiresAt</c> is the token expiry as an
/// ISO-8601 string.
/// </para>
/// </summary>
public sealed record DeviceTokenResponseDto(
    string AppJwt,
    DateTimeOffset ExpiresAt);
