namespace Tickets.Application.Devices.Queries;

/// <summary>
/// Device self-status (legacy <c>GET /device/status</c>). Device id is read
/// from <c>ICurrentDevice</c> — no body.
/// </summary>
public sealed record GetDeviceStatusQuery;
