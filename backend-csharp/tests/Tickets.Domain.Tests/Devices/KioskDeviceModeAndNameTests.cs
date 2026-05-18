using Tickets.Domain.Devices;
using Tickets.Domain.Devices.Errors;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Devices;

public sealed class KioskDeviceModeAndNameTests
{
    [Fact]
    public void ChangeName_OnPaired_UpdatesAndRaisesEvent()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.ClearDomainEvents();
        var newName = DeviceName.Parse("Kiosk-Lobby");

        device.ChangeName(newName, clock);

        device.Name.Should().Be(newName);
        device.DomainEvents.OfType<DeviceNameChanged>().Single().NewName.Should().Be(newName);
    }

    [Fact]
    public void ChangeName_SameName_NoOp()
    {
        var device = KioskDeviceTestData.APairedDevice();
        device.ClearDomainEvents();
        var v = device.Version;

        device.ChangeName(device.Name, new FakeClock());

        device.Version.Should().Be(v);
        device.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void ChangeName_OnUnpaired_Throws()
    {
        var device = KioskDeviceTestData.AnUnpairedDevice();
        var act = () => device.ChangeName(DeviceName.Parse("x"), new FakeClock());
        act.Should().Throw<DeviceNotPairedError>();
    }

    [Fact]
    public void ChangeMode_OnIdleDevice_UpdatesMode()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(DeviceMode.Registration, clock);
        device.ClearDomainEvents();

        device.ChangeMode(DeviceMode.Feedback, clock);

        device.Mode.Should().Be(DeviceMode.Feedback);
        var evt = device.DomainEvents.OfType<DeviceModeChanged>().Single();
        evt.From.Should().Be(DeviceMode.Registration);
        evt.To.Should().Be(DeviceMode.Feedback);
    }

    [Fact]
    public void ChangeMode_OnBusyDevice_Throws_DeviceBusyError()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.ABusyDevice(out _, clock: clock);
        var act = () => device.ChangeMode(DeviceMode.Feedback, clock);
        act.Should().Throw<DeviceBusyError>();
        device.Mode.Should().Be(DeviceMode.Registration);
    }

    [Fact]
    public void ChangeMode_SameMode_NoOp()
    {
        var device = KioskDeviceTestData.APairedDevice(DeviceMode.Registration);
        device.ClearDomainEvents();
        var v = device.Version;

        device.ChangeMode(DeviceMode.Registration, new FakeClock());

        device.Version.Should().Be(v);
        device.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void ChangeMode_OnUnpaired_Throws()
    {
        var device = KioskDeviceTestData.AnUnpairedDevice();
        var act = () => device.ChangeMode(DeviceMode.Feedback, new FakeClock());
        act.Should().Throw<DeviceNotPairedError>();
    }
}
