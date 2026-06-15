namespace Tickets.Application.Devices.Dtos;

/// <summary>
/// Wrapper for <c>GET /device</c>. The dashboard reads
/// <c>res.items</c> (frontend useDevices.ts: <c>allDevicesRes.items</c>;
/// api.ts <c>DevicesListRes = { items: DevicesListItem[] }</c>), so the list
/// MUST be wrapped — a bare JSON array would break the hook.
/// </summary>
public sealed record DeviceListResponseDto(IReadOnlyList<DeviceDto> Items);
