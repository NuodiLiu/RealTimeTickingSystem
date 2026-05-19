using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Application.Devices.Configuration;
using Tickets.Application.Devices.EventHandlers;
using Tickets.Domain.Devices;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Infrastructure.Devices;
using Tickets.Infrastructure.Events;
using Tickets.Infrastructure.Notifications;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;
using Tickets.Infrastructure.Tests.Persistence;

namespace Tickets.Infrastructure.Tests.Devices;

[Collection("postgres")]
public sealed class DeviceConnectivitySweeperServiceTests : IAsyncLifetime
{
    private readonly PostgresFixture _fixture;
    private readonly MutableClock _clock = new(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
    private readonly DeviceConnectivityOptions _options = new()
    {
        OfflineThreshold = TimeSpan.FromSeconds(90),
        SweeperInterval = TimeSpan.FromSeconds(15),
        StartupGracePeriod = TimeSpan.FromSeconds(180),
    };
    private FakeNotificationGateway _gateway = null!;
    private ServiceProvider _provider = null!;

    public DeviceConnectivitySweeperServiceTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        await _fixture.ResetAsync();

        var services = new ServiceCollection();
        services.AddSingleton<IClock>(_clock);
        services.AddSingleton(Options.Create(_options));
        services.AddSingleton<FakeNotificationGateway>();
        services.AddSingleton<INotificationGateway>(sp => sp.GetRequiredService<FakeNotificationGateway>());
        services.AddSingleton(NullLoggerFactory.Instance);
        services.AddLogging();

        services.AddDbContext<TicketsDbContext>(opts => opts.UseNpgsql(_fixture.ConnectionString));
        services.AddScoped<IKioskDeviceRepository, KioskDeviceRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Domain-event dispatch wiring: the SAME path production uses.
        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();
        services.AddScoped<IDomainEventHandler<DeviceConnectionStateChanged>, DeviceConnectionEventHandler>();

        _provider = services.BuildServiceProvider();
        _gateway = _provider.GetRequiredService<FakeNotificationGateway>();
    }

    public async Task DisposeAsync()
    {
        await _provider.DisposeAsync();
    }

    private DeviceConnectivitySweeperService BuildSweeper() => new(
        _provider.GetRequiredService<IServiceScopeFactory>(),
        _clock,
        Options.Create(_options),
        NullLogger<DeviceConnectivitySweeperService>.Instance);

    private async Task<DeviceId> SeedConnectedDeviceAsync(
        DateTimeOffset lastSeenAt, string name = "Kiosk-Stale")
    {
        // Construct at lastSeenAt so LastSeenAt is set to the desired value
        // (Pair seeds LastSeenAt = clock.UtcNow). Then bring it online with
        // a heartbeat at the same logical moment.
        var snapshot = new MutableClock(lastSeenAt);
        var device = KioskDevice.Pair(
            DeviceName.Parse(name), SecretHash.FromRaw("hash"),
            DeviceMode.Registration, snapshot);
        device.RecordHeartbeat(snapshot);

        using var scope = _provider.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IKioskDeviceRepository>();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        await repo.AddAsync(device);
        await uow.CommitAsync();
        return device.Id;
    }

    [Fact]
    public async Task RunTickAsync_StaleDevice_MarksOfflineAndPushesNotification()
    {
        // Device seen 91s ago (> 90s OfflineThreshold).
        var seenAt = _clock.UtcNow;
        var deviceId = await SeedConnectedDeviceAsync(seenAt);

        // Build sweeper; advance clock past startup grace + threshold.
        var sweeper = BuildSweeper();
        _clock.Advance(_options.StartupGracePeriod + TimeSpan.FromSeconds(91));
        _gateway.Reset();

        var marked = await sweeper.RunTickAsync(CancellationToken.None);

        marked.Should().Be(1);
        await using var verify = _fixture.CreateContext();
        var reloaded = await verify.Devices.SingleAsync(d => d.Id == deviceId);
        reloaded.IsConnected.Should().BeFalse();

        _gateway.Log.Should().Contain(e =>
            e.EventType == "device:offline" && e.Target == "dashboard:*");
    }

    [Fact]
    public async Task RunTickAsync_DeviceSeenRecently_NoChange()
    {
        // Seed AFTER advancing the clock so the device's LastSeenAt is set
        // relative to the time the sweeper will sample, not relative to T0.
        var sweeper = BuildSweeper();
        _clock.Advance(_options.StartupGracePeriod + TimeSpan.FromSeconds(30));
        var recentLastSeen = _clock.UtcNow - TimeSpan.FromSeconds(10); // 10s old << 90s threshold
        var deviceId = await SeedConnectedDeviceAsync(recentLastSeen);
        _gateway.Reset();

        var marked = await sweeper.RunTickAsync(CancellationToken.None);

        marked.Should().Be(0);
        await using var verify = _fixture.CreateContext();
        var reloaded = await verify.Devices.SingleAsync(d => d.Id == deviceId);
        reloaded.IsConnected.Should().BeTrue();
        _gateway.Log.Should().BeEmpty();
    }

    [Fact]
    public async Task RunTickAsync_WithinStartupGrace_DoesNothing()
    {
        var deviceId = await SeedConnectedDeviceAsync(_clock.UtcNow);

        var sweeper = BuildSweeper();
        // Make device truly stale but stay inside grace window.
        _clock.Advance(TimeSpan.FromSeconds(120)); // 120s < 180s grace, but > 90s threshold.
        _gateway.Reset();

        var marked = await sweeper.RunTickAsync(CancellationToken.None);

        marked.Should().Be(0);
        await using var verify = _fixture.CreateContext();
        var reloaded = await verify.Devices.SingleAsync(d => d.Id == deviceId);
        reloaded.IsConnected.Should().BeTrue();
    }

    [Fact]
    public async Task RunTickAsync_AlreadyDisconnectedStaleDevice_NotPickedUp()
    {
        // Seed connected then immediately disconnect — repository's
        // ListStaleConnectedAsync filters on is_connected=true, so this row
        // should not appear in the candidate set.
        var deviceId = await SeedConnectedDeviceAsync(_clock.UtcNow);
        using (var scope = _provider.CreateScope())
        {
            var repo = scope.ServiceProvider.GetRequiredService<IKioskDeviceRepository>();
            var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var device = await repo.FindByIdAsync(deviceId);
            device!.MarkDisconnected(_clock);
            await uow.CommitAsync();
        }

        var sweeper = BuildSweeper();
        _clock.Advance(_options.StartupGracePeriod + TimeSpan.FromSeconds(91));
        _gateway.Reset();

        var marked = await sweeper.RunTickAsync(CancellationToken.None);

        marked.Should().Be(0);
        _gateway.Log.Should().BeEmpty();
    }

    private sealed class MutableClock(DateTimeOffset start) : IClock
    {
        public DateTimeOffset UtcNow { get; private set; } = start;
        public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
    }
}
