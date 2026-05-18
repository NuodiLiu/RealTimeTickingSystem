using Tickets.Domain.Devices;

namespace Tickets.Application.Abstractions;

/// <summary>
/// Sends real-time notifications to dashboards (broadcast) and devices
/// (point-to-point). The Phase 5 implementation is backed by Azure SignalR;
/// earlier phases use <c>FakeNotificationGateway</c>.
/// <para>
/// Implementations MUST swallow transport failures internally — a SignalR
/// outage must not surface as an HTTP 500 to the caller. AGENTS.md §7 #6.
/// </para>
/// </summary>
public interface INotificationGateway
{
    /// <summary>Broadcasts a typed event to every connected dashboard client.</summary>
    Task NotifyDashboardAsync(
        string eventType,
        object payload,
        CancellationToken cancellationToken = default);

    /// <summary>Sends a typed event to a specific paired device.</summary>
    Task PushToDeviceAsync(
        DeviceId deviceId,
        string eventType,
        object payload,
        CancellationToken cancellationToken = default);
}
