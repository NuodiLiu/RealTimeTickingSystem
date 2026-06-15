using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Dtos;

/// <summary>
/// Response for <c>GET /device/status</c> (device-auth). Matches the frontend
/// <c>DeviceAPI.status()</c> decoder: <c>{ ok, deviceId, mode, online }</c>.
/// <c>mode</c> serializes to REGISTRATION / FEEDBACK via the wire-enum converter.
/// </summary>
public sealed record DeviceStatusDto(
    bool Ok,
    Guid DeviceId,
    DeviceMode Mode,
    bool Online);

/// <summary>
/// Response for <c>PATCH /device/{id}/mode</c>. Matches the frontend
/// <c>DeviceAPI.changeMode()</c> decoder: <c>{ id, name, mode, lastSeenAt }</c>.
/// </summary>
public sealed record ChangeDeviceModeResponseDto(
    Guid Id,
    string Name,
    DeviceMode Mode,
    DateTimeOffset LastSeenAt)
{
    public static ChangeDeviceModeResponseDto From(KioskDevice device)
    {
        ArgumentNullException.ThrowIfNull(device);
        return new ChangeDeviceModeResponseDto(
            Id: device.Id.Value,
            Name: device.Name.Value,
            Mode: device.Mode,
            LastSeenAt: device.LastSeenAt);
    }
}

/// <summary>
/// Response for <c>PATCH /device/{id}/name</c>. Matches the frontend
/// <c>UpdateDeviceNameRes</c>: <c>{ success, device: { id, name, mode,
/// lastSeenAt } }</c>.
/// </summary>
public sealed record UpdateDeviceNameResponseDto(
    bool Success,
    ChangeDeviceModeResponseDto Device)
{
    public static UpdateDeviceNameResponseDto From(KioskDevice device) =>
        new(Success: true, Device: ChangeDeviceModeResponseDto.From(device));
}
