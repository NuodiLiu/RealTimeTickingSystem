using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Queries;

/// <summary>
/// Staff lists paired devices, optionally filtered by mode (legacy
/// <c>GET /device</c> with <c>?mode=</c> and <c>GET /device/by-mode/{mode}</c>
/// collapsed into one). Pagination keeps the response bounded —
/// fixes api-device.md pitfall #1 (legacy unbounded).
/// </summary>
public sealed record ListDevicesQuery(
    DeviceMode? Mode = null,
    int Page = 1,
    int PageSize = 50);
