using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Devices.EventHandlers;
using Tickets.Domain.Devices;
using Tickets.Domain.Devices.Events;

namespace Tickets.Application.Tests.Devices;

public sealed class DeviceConnectionEventHandlerTests
{
    private readonly INotificationGateway _gateway = Substitute.For<INotificationGateway>();

    private DeviceConnectionEventHandler Handler() =>
        new(_gateway, NullLogger<DeviceConnectionEventHandler>.Instance);

    [Fact]
    public async Task HandleAsync_Connected_PushesDeviceOnline()
    {
        var deviceId = DeviceId.New();
        var now = new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero);
        var @event = new DeviceConnectionStateChanged(deviceId, IsConnected: true, now, now);

        await Handler().HandleAsync(@event, CancellationToken.None);

        await _gateway.Received(1).NotifyDashboardAsync(
            "device:online",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_Disconnected_PushesDeviceOffline()
    {
        var deviceId = DeviceId.New();
        var now = new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero);
        var @event = new DeviceConnectionStateChanged(deviceId, IsConnected: false, now, now);

        await Handler().HandleAsync(@event, CancellationToken.None);

        await _gateway.Received(1).NotifyDashboardAsync(
            "device:offline",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_GatewayThrows_DoesNotRethrow()
    {
        _gateway
            .NotifyDashboardAsync(Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("transport down")));

        var @event = new DeviceConnectionStateChanged(
            DeviceId.New(), IsConnected: true, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

        var act = async () => await Handler().HandleAsync(@event, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }
}
