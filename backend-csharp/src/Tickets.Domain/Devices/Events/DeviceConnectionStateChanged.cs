using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

/// <summary>
/// Single event for both "device connected" and "device disconnected" so
/// SignalR webhooks can produce one consistent stream regardless of direction.
/// </summary>
public sealed record DeviceConnectionStateChanged(
    DeviceId DeviceId,
    bool IsConnected,
    DateTimeOffset LastSeenAt,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
