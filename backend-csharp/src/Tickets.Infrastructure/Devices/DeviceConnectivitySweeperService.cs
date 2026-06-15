using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Tickets.Application.Devices.Configuration;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Infrastructure.Devices;

/// <summary>
/// Periodically scans <c>kiosk_devices</c> for paired devices whose last
/// heartbeat predates <c>OfflineThreshold</c> and marks them offline. The
/// <c>DeviceConnectionStateChanged</c> event raised by
/// <c>KioskDevice.MarkDisconnected</c> is fanned out to the dashboard by
/// the domain-event dispatcher attached to <c>UnitOfWork</c> — this service
/// never talks to <c>INotificationGateway</c> directly.
/// <para>
/// Single-instance only. Horizontal scaling needs leader election or
/// migration to a queue-driven model. Tracked as a Phase-5 concern.
/// </para>
/// </summary>
internal sealed class DeviceConnectivitySweeperService(
    IServiceScopeFactory scopeFactory,
    IClock clock,
    IOptions<DeviceConnectivityOptions> options,
    ILogger<DeviceConnectivitySweeperService> logger)
    : BackgroundService
{
    private readonly DateTimeOffset _processStartUtc = clock.UtcNow;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var opts = options.Value;
        logger.LogInformation(
            "Device connectivity sweeper starting (interval={Interval}, threshold={Threshold}, grace={Grace}).",
            opts.SweeperInterval,
            opts.OfflineThreshold,
            opts.StartupGracePeriod);

        using var timer = new PeriodicTimer(opts.SweeperInterval);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunTickAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Device connectivity sweeper tick failed.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
                {
                    break;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    /// <summary>
    /// One sweep pass. <c>internal</c> so tests can drive ticks directly
    /// without spinning up the periodic timer. Honours
    /// <c>StartupGracePeriod</c> — call sites past the grace window will
    /// process devices; calls within the window are a no-op.
    /// </summary>
    internal async Task<int> RunTickAsync(CancellationToken cancellationToken)
    {
        var opts = options.Value;
        var now = clock.UtcNow;

        if (now - _processStartUtc < opts.StartupGracePeriod)
        {
            return 0;
        }

        var cutoff = now - opts.OfflineThreshold;

        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IKioskDeviceRepository>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var stale = await repository
            .ListStaleConnectedAsync(cutoff, cancellationToken)
            .ConfigureAwait(false);

        if (stale.Count == 0)
        {
            return 0;
        }

        var markedOffline = 0;
        foreach (var device in stale)
        {
            try
            {
                device.MarkDisconnected(clock);
                await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);
                markedOffline++;
            }
            catch (ConcurrencyError)
            {
                // Another writer touched the row between SELECT and UPDATE.
                // Leave it for the next tick — we will re-evaluate against a
                // fresh snapshot.
                logger.LogWarning(
                    "Concurrency conflict marking device {DeviceId} offline; will retry next tick.",
                    device.Id);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(
                    ex,
                    "Failed to mark device {DeviceId} offline.",
                    device.Id);
            }
        }

        if (markedOffline > 0)
        {
            logger.LogInformation(
                "Sweeper marked {Count} device(s) offline (cutoff={Cutoff:o}).",
                markedOffline,
                cutoff);
        }

        return markedOffline;
    }
}
