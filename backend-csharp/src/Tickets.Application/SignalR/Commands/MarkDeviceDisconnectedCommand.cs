namespace Tickets.Application.SignalR.Commands;

/// <summary>
/// Azure SignalR webhook reports a device socket closed. Flips IsConnected
/// only — does NOT release the active lock (AGENTS.md §8.1 fix for
/// api-signalr.md pitfall #4). A background sweeper handles lease expiry.
/// </summary>
public sealed record MarkDeviceDisconnectedCommand(Guid DeviceId);
