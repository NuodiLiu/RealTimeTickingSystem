namespace Tickets.Application.Devices.Commands;

/// <summary>
/// Mints a DEVICE App-JWT for the calling (device-header-authenticated) device.
/// The device id is read from <c>ICurrentDevice</c> — no body.
/// </summary>
public sealed record IssueDeviceTokenCommand;
