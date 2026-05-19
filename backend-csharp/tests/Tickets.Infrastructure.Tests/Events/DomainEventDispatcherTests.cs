using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Tickets.Application.Abstractions;
using Tickets.Domain.Devices;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Shared.Events;
using Tickets.Infrastructure.Events;

namespace Tickets.Infrastructure.Tests.Events;

public sealed class DomainEventDispatcherTests
{
    [Fact]
    public async Task DispatchAsync_WithRegisteredHandler_InvokesIt()
    {
        var handler = Substitute.For<IDomainEventHandler<DeviceConnectionStateChanged>>();
        var services = new ServiceCollection();
        services.AddSingleton(handler);
        await using var provider = services.BuildServiceProvider();

        var dispatcher = new DomainEventDispatcher(
            provider, NullLogger<DomainEventDispatcher>.Instance);

        var @event = new DeviceConnectionStateChanged(
            DeviceId.New(), IsConnected: true, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

        await dispatcher.DispatchAsync(new DomainEvent[] { @event }, CancellationToken.None);

        await handler.Received(1).HandleAsync(@event, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchAsync_WithNoHandlers_DoesNotThrow()
    {
        var services = new ServiceCollection();
        await using var provider = services.BuildServiceProvider();

        var dispatcher = new DomainEventDispatcher(
            provider, NullLogger<DomainEventDispatcher>.Instance);

        var @event = new DeviceConnectionStateChanged(
            DeviceId.New(), IsConnected: false, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

        var act = async () => await dispatcher.DispatchAsync(
            new DomainEvent[] { @event }, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task DispatchAsync_OneHandlerThrows_OthersStillInvoked()
    {
        var failing = Substitute.For<IDomainEventHandler<DeviceConnectionStateChanged>>();
        failing
            .HandleAsync(Arg.Any<DeviceConnectionStateChanged>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("boom")));
        var good = Substitute.For<IDomainEventHandler<DeviceConnectionStateChanged>>();

        var services = new ServiceCollection();
        services.AddSingleton(failing);
        services.AddSingleton(good);
        await using var provider = services.BuildServiceProvider();

        var dispatcher = new DomainEventDispatcher(
            provider, NullLogger<DomainEventDispatcher>.Instance);

        var @event = new DeviceConnectionStateChanged(
            DeviceId.New(), IsConnected: true, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

        await dispatcher.DispatchAsync(new DomainEvent[] { @event }, CancellationToken.None);

        await good.Received(1).HandleAsync(@event, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchAsync_EmptyList_NoOp()
    {
        await using var provider = new ServiceCollection().BuildServiceProvider();
        var dispatcher = new DomainEventDispatcher(
            provider, NullLogger<DomainEventDispatcher>.Instance);

        var act = async () => await dispatcher.DispatchAsync(
            Array.Empty<DomainEvent>(), CancellationToken.None);

        await act.Should().NotThrowAsync();
    }
}
