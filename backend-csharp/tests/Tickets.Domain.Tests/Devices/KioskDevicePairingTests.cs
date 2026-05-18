using Tickets.Domain.Devices;
using Tickets.Domain.Devices.Errors;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Devices;

public sealed class KioskDevicePairingTests
{
    [Fact]
    public void Pair_NewDevice_StartsInPairedIdleState()
    {
        var clock = new FakeClock();

        var device = KioskDevice.Pair(
            KioskDeviceTestData.AName(),
            KioskDeviceTestData.ASecret(),
            DeviceMode.Registration,
            clock);

        device.PairingStatus.Should().Be(PairingStatus.Paired);
        device.IsBusy.Should().BeFalse();
        device.Mode.Should().Be(DeviceMode.Registration);
        device.LastSeenAt.Should().Be(clock.UtcNow);
        device.IsConnected.Should().BeFalse();
        device.Version.Should().Be(1);
    }

    [Fact]
    public void Pair_NewDevice_RaisesDevicePairedEvent()
    {
        var device = KioskDeviceTestData.APairedDevice();
        device.DomainEvents.OfType<DevicePaired>().Should().ContainSingle();
    }

    [Fact]
    public void RotateSecret_OnPairedDevice_UpdatesHashAndBumpsVersion()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.ClearDomainEvents();
        var v = device.Version;
        var newHash = SecretHash.FromRaw("cafebabe");

        device.RotateSecret(newHash, clock);

        device.SecretHash.Should().Be(newHash);
        device.Version.Should().Be(v + 1);
        device.DomainEvents.OfType<DeviceSecretRotated>().Should().ContainSingle();
    }

    [Fact]
    public void RotateSecret_OnUnpairedDevice_Throws()
    {
        var device = KioskDeviceTestData.AnUnpairedDevice();
        var act = () => device.RotateSecret(SecretHash.FromRaw("x"), new FakeClock());
        act.Should().Throw<DeviceNotPairedError>();
    }

    [Fact]
    public void Unpair_OnIdleDevice_TransitionsToUnpairedAndClearsSecret()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.ClearDomainEvents();

        device.Unpair(clock);

        device.PairingStatus.Should().Be(PairingStatus.Unpaired);
        device.SecretHash.IsCleared.Should().BeTrue();
        device.DomainEvents.OfType<DeviceUnpaired>().Should().ContainSingle();
    }

    [Fact]
    public void Unpair_OnBusyDevice_Throws_DeviceBusyError()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.ABusyDevice(out var lockId, clock: clock);

        var act = () => device.Unpair(clock);

        var ex = act.Should().Throw<DeviceBusyError>().Which;
        ex.ActiveLockId.Should().Be(lockId);
        device.PairingStatus.Should().Be(PairingStatus.Paired); // unchanged
    }

    [Fact]
    public void Unpair_OnAlreadyUnpaired_Throws_DeviceNotPaired()
    {
        var device = KioskDeviceTestData.AnUnpairedDevice();
        var act = () => device.Unpair(new FakeClock());
        act.Should().Throw<DeviceNotPairedError>();
    }

    [Fact]
    public void RestorePairing_OnUnpairedDevice_TransitionsToPaired()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.AnUnpairedDevice(clock);
        device.ClearDomainEvents();
        clock.Advance(TimeSpan.FromMinutes(1));

        device.RestorePairing(SecretHash.FromRaw("new-hash"), DeviceMode.Feedback, clock);

        device.PairingStatus.Should().Be(PairingStatus.Paired);
        device.SecretHash.IsCleared.Should().BeFalse();
        device.Mode.Should().Be(DeviceMode.Feedback);
        device.LastSeenAt.Should().Be(clock.UtcNow);
        device.DomainEvents.OfType<DevicePairingRestored>().Should().ContainSingle();
    }

    [Fact]
    public void RestorePairing_OnAlreadyPaired_Throws_DeviceAlreadyPaired()
    {
        var device = KioskDeviceTestData.APairedDevice();
        var act = () => device.RestorePairing(
            SecretHash.FromRaw("x"), DeviceMode.Registration, new FakeClock());

        act.Should().Throw<DeviceAlreadyPairedError>();
    }
}
