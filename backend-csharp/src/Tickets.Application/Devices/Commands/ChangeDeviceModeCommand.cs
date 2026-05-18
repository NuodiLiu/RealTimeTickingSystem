namespace Tickets.Application.Devices.Commands;

/// <summary>
/// Staff switches a device between Registration and Feedback modes
/// (legacy <c>PATCH /device/:id/mode</c>). Allowed only when the device is
/// Idle — the aggregate enforces.
/// </summary>
public sealed record ChangeDeviceModeCommand(Guid DeviceId, string Mode);
