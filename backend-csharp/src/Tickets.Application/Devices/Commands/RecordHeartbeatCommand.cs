namespace Tickets.Application.Devices.Commands;

/// <summary>
/// Device pings the server (legacy <c>POST /device/heartbeat</c>). Device id
/// comes from <see cref="Tickets.Application.Abstractions.ICurrentDevice"/>,
/// not the body — there is nothing to put in the body.
/// </summary>
public sealed record RecordHeartbeatCommand;
