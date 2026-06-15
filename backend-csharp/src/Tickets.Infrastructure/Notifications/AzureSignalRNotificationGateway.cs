using System.Text.Json;
using Azure.Core.Serialization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Azure.SignalR.Management;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Notifications;

/// <summary>
/// Phase 5 <see cref="INotificationGateway"/> backed by Azure SignalR Service
/// in <b>serverless</b> mode (<see cref="ServiceTransportType.Transient"/>).
/// Uses a single <see cref="IServiceManager"/> and a lazily-created, cached
/// <see cref="ServiceHubContext"/> for the <c>ticketingHub</c> hub.
/// <para>
/// Client-facing method names are fixed by the existing dashboard/device
/// clients: dashboards listen on <c>"message"</c>, devices on
/// <c>"deviceMessage"</c>, each carrying <c>{ type, payload }</c>. The hub
/// protocol JSON is configured to camelCase so those keys arrive lower-cased.
/// </para>
/// <para>
/// Per AGENTS.md §7 #6, every transport failure is swallowed and logged at
/// warning level — a SignalR outage must never bubble up as an HTTP 500.
/// </para>
/// </summary>
public sealed class AzureSignalRNotificationGateway : INotificationGateway, IAsyncDisposable
{
    /// <summary>Hub name shared with the client SDKs.</summary>
    public const string HubName = "ticketingHub";

    /// <summary>Dashboards join this group; broadcasts fan out to it.</summary>
    public const string DashboardGroup = "dashboard";

    /// <summary>Client method dashboards subscribe to.</summary>
    public const string DashboardMethod = "message";

    /// <summary>Client method paired devices subscribe to.</summary>
    public const string DeviceMethod = "deviceMessage";

    /// <summary>
    /// Maps the Application-layer device event names to the canonical wire
    /// <c>type</c> strings the iPad expects (see
    /// <c>contracts/signalr/server-to-device/*.json</c>). The mapping is done
    /// GATEWAY-SIDE so the Application handlers (and their unit tests) keep
    /// emitting their existing names. Any name not in this table is passed
    /// through unchanged — that covers <c>UNPAIRED</c> (already canonical) and
    /// future already-normalized types.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> DeviceTypeMap =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["showFeedback"] = "SHOW_FEEDBACK",
            ["dismissDevice"] = "DISMISS",
            ["changeMode"] = "MODE_CHANGED",
        };

    private readonly ServiceManager _serviceManager;
    private readonly ILogger<AzureSignalRNotificationGateway> _logger;
    private readonly SemaphoreSlim _hubGate = new(1, 1);
    private volatile ServiceHubContext? _hubContext;
    private bool _disposed;

    public AzureSignalRNotificationGateway(
        IOptions<AzureSignalROptions> options,
        ILoggerFactory loggerFactory)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(loggerFactory);

        _logger = loggerFactory.CreateLogger<AzureSignalRNotificationGateway>();

        var connectionString = options.Value.ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Azure:SignalR:ConnectionString must be configured to use the Azure SignalR gateway.");
        }

        _serviceManager = new ServiceManagerBuilder()
            .WithOptions(o =>
            {
                o.ConnectionString = connectionString;
                // Serverless mode: the API host never holds a persistent
                // server connection; messages are sent over transient HTTP.
                o.ServiceTransportType = ServiceTransportType.Transient;
                // camelCase the hub protocol JSON so the { type, payload }
                // envelope arrives with lower-cased keys the clients expect.
                o.UseJsonObjectSerializer(new JsonObjectSerializer(
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    }));
            })
            .WithLoggerFactory(loggerFactory)
            .BuildServiceManager();
    }

    /// <summary>
    /// Negotiates a client connection. Used by the negotiate endpoint to mint a
    /// per-user access token + service URL. Failures here DO propagate — the
    /// caller needs a real token to connect; this is not a fire-and-forget send.
    /// </summary>
    public async Task<Microsoft.AspNetCore.Http.Connections.NegotiationResponse> NegotiateAsync(
        NegotiationOptions negotiationOptions,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(negotiationOptions);
        var hub = await GetHubContextAsync(cancellationToken).ConfigureAwait(false);
        return await hub.NegotiateAsync(negotiationOptions, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Persists group membership for a (not-yet-connected) user so the user is
    /// fanned-out to when it connects. Used by the negotiate endpoint to place
    /// dashboards in the <c>dashboard</c> group and devices in their
    /// <c>device:{id}</c> group. Failures are swallowed + logged — a missing
    /// group assignment must not fail the negotiate request.
    /// </summary>
    public async Task AddUserToGroupAsync(
        string userId, string groupName, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId);
        ArgumentException.ThrowIfNullOrWhiteSpace(groupName);
        try
        {
            var hub = await GetHubContextAsync(cancellationToken).ConfigureAwait(false);
            await hub.UserGroups
                .AddToGroupAsync(userId, groupName, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex, "Azure SignalR add-to-group failed for user {UserId} group {Group}.",
                userId, groupName);
        }
    }

    public async Task NotifyDashboardAsync(
        string eventType, object payload, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventType);
        try
        {
            var hub = await GetHubContextAsync(cancellationToken).ConfigureAwait(false);
            await hub.Clients
                .Group(DashboardGroup)
                .SendAsync(DashboardMethod, new { type = eventType, payload }, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex, "Azure SignalR dashboard broadcast failed for {EventType}.", eventType);
        }
    }

    public async Task PushToDeviceAsync(
        DeviceId deviceId, string eventType, object payload, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventType);
        // Normalize the Application-layer event name to the canonical iPad wire
        // type. Unknown names pass through unchanged (e.g. UNPAIRED).
        var wireType = DeviceTypeMap.GetValueOrDefault(eventType, eventType);
        try
        {
            var hub = await GetHubContextAsync(cancellationToken).ConfigureAwait(false);
            await hub.Clients
                .User(deviceId.Value.ToString())
                .SendAsync(DeviceMethod, new { type = wireType, payload }, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex, "Azure SignalR device push failed for {DeviceId} {EventType}.", deviceId, wireType);
        }
    }

    private async Task<ServiceHubContext> GetHubContextAsync(CancellationToken cancellationToken)
    {
        var existing = _hubContext;
        if (existing is not null)
        {
            return existing;
        }

        await _hubGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _hubContext ??= await _serviceManager
                .CreateHubContextAsync(HubName, cancellationToken)
                .ConfigureAwait(false);
            return _hubContext;
        }
        finally
        {
            _hubGate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;

        if (_hubContext is not null)
        {
            await _hubContext.DisposeAsync().ConfigureAwait(false);
        }
        if (_serviceManager is IAsyncDisposable asyncManager)
        {
            await asyncManager.DisposeAsync().ConfigureAwait(false);
        }
        else if (_serviceManager is IDisposable manager)
        {
            manager.Dispose();
        }
        _hubGate.Dispose();
    }
}
