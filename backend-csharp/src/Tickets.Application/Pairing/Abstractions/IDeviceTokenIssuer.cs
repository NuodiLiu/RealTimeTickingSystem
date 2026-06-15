using Tickets.Domain.Devices;

namespace Tickets.Application.Pairing.Abstractions;

/// <summary>
/// Mints the WebSocket / SignalR JWT a device uses to subscribe to events.
/// Phase 5 backs this with JWT signing; tests use a stub.
/// </summary>
public interface IDeviceTokenIssuer
{
    string IssueWebsocketToken(DeviceId deviceId, DeviceMode mode, TimeSpan ttl);
}
