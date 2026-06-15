namespace Tickets.Application.SignalR.Commands;

/// <summary>
/// Azure SignalR webhook reports a device opened a WebSocket. We treat this
/// as a strong heartbeat (updates LastSeenAt + IsConnected).
/// </summary>
public sealed record MarkDeviceConnectedCommand(Guid DeviceId);
