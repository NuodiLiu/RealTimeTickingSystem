using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Domain.Devices.Events;

namespace Tickets.Application.Devices.EventHandlers;

/// <summary>
/// Translates the <see cref="DeviceConnectionStateChanged"/> domain event
/// into a dashboard SignalR push. Both the heartbeat path (offline→online
/// edge raised inside <c>KioskDevice.RecordHeartbeat</c>) and the sweeper
/// path (online→offline raised inside <c>KioskDevice.MarkDisconnected</c>)
/// converge here — one consumer, one event type.
/// </summary>
public sealed class DeviceConnectionEventHandler(
    INotificationGateway gateway,
    ILogger<DeviceConnectionEventHandler> logger)
    : IDomainEventHandler<DeviceConnectionStateChanged>
{
    public async Task HandleAsync(
        DeviceConnectionStateChanged @event,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(@event);

        var eventType = @event.IsConnected ? "device:online" : "device:offline";
        var payload = new
        {
            deviceId = @event.DeviceId.Value,
            isConnected = @event.IsConnected,
            lastSeenAt = @event.LastSeenAt,
            occurredAt = @event.OccurredAt,
        };

        try
        {
            await gateway.NotifyDashboardAsync(eventType, payload, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Transport failures must not surface to the business commit
            // (AGENTS.md §7 #6). Log and drop.
            logger.LogWarning(
                ex,
                "Failed to push {EventType} notification for device {DeviceId}",
                eventType,
                @event.DeviceId);
        }
    }
}
