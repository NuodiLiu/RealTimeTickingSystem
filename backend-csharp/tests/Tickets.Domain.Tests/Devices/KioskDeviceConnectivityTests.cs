using Tickets.Domain.Devices.Errors;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Devices;

public sealed class KioskDeviceConnectivityTests
{
    [Fact]
    public void RecordHeartbeat_OnPaired_UpdatesLastSeenAndConnects()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.ClearDomainEvents();
        clock.Advance(TimeSpan.FromSeconds(30));

        device.RecordHeartbeat(clock);

        device.LastSeenAt.Should().Be(clock.UtcNow);
        device.IsConnected.Should().BeTrue();
        device.DomainEvents.OfType<DeviceConnectionStateChanged>().Should().ContainSingle();
    }

    [Fact]
    public void RecordHeartbeat_WhenAlreadyConnected_OnlyUpdatesLastSeenSilently()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.RecordHeartbeat(clock);
        device.ClearDomainEvents();

        clock.Advance(TimeSpan.FromSeconds(30));
        device.RecordHeartbeat(clock);

        device.LastSeenAt.Should().Be(clock.UtcNow);
        // No state-change event since IsConnected was already true.
        device.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void RecordHeartbeat_OnUnpaired_Throws_DeviceNotPaired()
    {
        var device = KioskDeviceTestData.AnUnpairedDevice();
        var act = () => device.RecordHeartbeat(new FakeClock());
        act.Should().Throw<DeviceNotPairedError>();
    }

    [Fact]
    public void MarkDisconnected_OnConnectedDevice_SetsConnectedFalse()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.RecordHeartbeat(clock);
        device.ClearDomainEvents();

        device.MarkDisconnected(clock);

        device.IsConnected.Should().BeFalse();
        device.DomainEvents.OfType<DeviceConnectionStateChanged>().Should().ContainSingle();
    }

    /// <summary>
    /// AGENTS.md §8.1 — fixes api-signalr.md pitfall #4:
    /// "disconnect 立刻 RESOLVE case" must NOT happen in the new system.
    /// MarkDisconnected only flips the connectivity flag; lock cleanup is the
    /// background job's job.
    /// </summary>
    [Fact]
    public void MarkDisconnected_OnBusyDevice_DoesNotReleaseLock()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.ABusyDevice(out var lockId, clock: clock);
        device.RecordHeartbeat(clock);
        device.ClearDomainEvents();

        device.MarkDisconnected(clock);

        device.IsBusy.Should().BeTrue();
        device.CurrentLock!.Id.Should().Be(lockId);
        device.DomainEvents.OfType<LockExpired>().Should().BeEmpty();
        device.DomainEvents.OfType<LockCompleted>().Should().BeEmpty();
    }

    [Theory]
    [InlineData(0, true)]         // just received heartbeat → online
    [InlineData(60, true)]        // within threshold
    [InlineData(121, false)]      // beyond default 120s threshold
    public void IsOnline_ConnectedAndRecent_True(double secondsSinceHeartbeat, bool expected)
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.RecordHeartbeat(clock);

        clock.Advance(TimeSpan.FromSeconds(secondsSinceHeartbeat));

        device.IsOnline(clock, TimeSpan.FromSeconds(120)).Should().Be(expected);
    }

    [Fact]
    public void IsOnline_DisconnectedFlag_False()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.RecordHeartbeat(clock);
        device.MarkDisconnected(clock);

        device.IsOnline(clock, TimeSpan.FromSeconds(120)).Should().BeFalse();
    }
}
