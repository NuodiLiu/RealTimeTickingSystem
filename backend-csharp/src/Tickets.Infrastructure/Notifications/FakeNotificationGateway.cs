using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Notifications;

/// <summary>
/// Production-grade <see cref="INotificationGateway"/> for the pre-Phase-5
/// world. Records every fan-out to an in-memory log so tests can observe
/// what handlers attempted to push, and logs at info level so manual
/// integration smoke tests can watch traffic in the console.
/// <para>
/// When Phase 5 wires Azure SignalR, swap this registration for the real
/// gateway. Handlers don't change.
/// </para>
/// </summary>
public sealed class FakeNotificationGateway(ILogger<FakeNotificationGateway> logger)
    : INotificationGateway
{
    private readonly ConcurrentQueue<NotificationLog> _log = new();

    /// <summary>Observable log of every notification. Useful in tests.</summary>
    public IReadOnlyCollection<NotificationLog> Log => _log;

    public Task NotifyDashboardAsync(
        string eventType, object payload, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventType);
        var entry = new NotificationLog("dashboard:*", eventType, payload);
        _log.Enqueue(entry);
        logger.LogInformation("[Notify] dashboard {EventType}", eventType);
        return Task.CompletedTask;
    }

    public Task PushToDeviceAsync(
        DeviceId deviceId, string eventType, object payload, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventType);
        var entry = new NotificationLog($"device:{deviceId.Value}", eventType, payload);
        _log.Enqueue(entry);
        logger.LogInformation("[Notify] device {DeviceId} {EventType}", deviceId, eventType);
        return Task.CompletedTask;
    }

    /// <summary>Drops accumulated log entries — call between test cases.</summary>
    public void Reset() => _log.Clear();
}

/// <summary>One observed notification call.</summary>
public sealed record NotificationLog(string Target, string EventType, object Payload);
