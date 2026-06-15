using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Devices.Errors;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Devices;

public sealed class KioskDeviceLockTests
{
    private static readonly TimeSpan Lease = KioskDeviceTestData.DefaultLease;

    [Fact]
    public void AcquireLock_OnIdleDevice_TransitionsToBusyAndReturnsLock()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.ClearDomainEvents();
        var staff = StaffId.New();
        var caseId = CaseId.New();

        var lk = device.AcquireLock(staff, caseId, Lease, clock);

        device.IsBusy.Should().BeTrue();
        device.CurrentLock.Should().NotBeNull();
        device.CurrentLock!.Id.Should().Be(lk.Id);
        lk.StaffId.Should().Be(staff);
        lk.CaseId.Should().Be(caseId);
        lk.Version.Should().Be(1);
        lk.LeaseExpireAt.Should().Be(clock.UtcNow + Lease);
        device.DomainEvents.OfType<LockAcquired>().Should().ContainSingle();
    }

    [Fact]
    public void AcquireLock_OnBusyDevice_Throws_DeviceBusy()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.ABusyDevice(out _, clock: clock);
        var act = () => device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);
        act.Should().Throw<DeviceBusyError>();
    }

    [Fact]
    public void AcquireLock_OnUnpairedDevice_Throws()
    {
        var device = KioskDeviceTestData.AnUnpairedDevice();
        var act = () => device.AcquireLock(StaffId.New(), CaseId.New(), Lease, new FakeClock());
        act.Should().Throw<DeviceNotPairedError>();
    }

    [Fact]
    public void CompleteLock_OnBusy_TransitionsToIdleAndRaisesEvent()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);
        device.ClearDomainEvents();

        device.CompleteLock(lk.Id, lk.Version, clock);

        device.IsBusy.Should().BeFalse();
        device.CurrentLock.Should().BeNull();
        device.DomainEvents.OfType<LockCompleted>().Single().LockId.Should().Be(lk.Id);
    }

    [Fact]
    public void CompleteLock_OnIdle_Throws_LockNotActive()
    {
        var device = KioskDeviceTestData.APairedDevice();
        var act = () => device.CompleteLock(KioskLockId.New(), 1, new FakeClock());
        act.Should().Throw<LockNotActiveError>();
    }

    [Fact]
    public void CompleteLock_WrongLockId_Throws_PreconditionFailed()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);

        var act = () => device.CompleteLock(KioskLockId.New(), lk.Version, clock);

        act.Should().Throw<LockPreconditionFailedError>();
        device.IsBusy.Should().BeTrue();
    }

    [Fact]
    public void CompleteLock_WrongVersion_Throws_PreconditionFailed()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);

        var act = () => device.CompleteLock(lk.Id, lk.Version + 99, clock);

        act.Should().Throw<LockPreconditionFailedError>();
        device.IsBusy.Should().BeTrue();
    }

    [Fact]
    public void OverrideLock_OnBusy_ReplacesLockAndRaisesOverridden()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var oldLk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);
        device.ClearDomainEvents();

        var newStaff = StaffId.New();
        var newCase = CaseId.New();
        var newLk = device.OverrideLock(oldLk.Id, oldLk.Version, newStaff, newCase, Lease, clock);

        device.IsBusy.Should().BeTrue();
        device.CurrentLock!.Id.Should().Be(newLk.Id);
        device.CurrentLock.Id.Should().NotBe(oldLk.Id);
        device.CurrentLock.StaffId.Should().Be(newStaff);
        device.CurrentLock.CaseId.Should().Be(newCase);

        var evt = device.DomainEvents.OfType<LockOverridden>().Single();
        evt.OldLockId.Should().Be(oldLk.Id);
        evt.OldCaseId.Should().Be(oldLk.CaseId);
        evt.NewLockId.Should().Be(newLk.Id);
        evt.NewStaffId.Should().Be(newStaff);
        evt.NewCaseId.Should().Be(newCase);
    }

    [Fact]
    public void OverrideLock_OnIdle_Throws_LockNotActive()
    {
        var device = KioskDeviceTestData.APairedDevice();
        var act = () => device.OverrideLock(
            KioskLockId.New(), 1, StaffId.New(), CaseId.New(), Lease, new FakeClock());

        act.Should().Throw<LockNotActiveError>();
    }

    [Fact]
    public void OverrideLock_VersionMismatch_Throws_PreconditionFailed()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var oldLk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);

        var act = () => device.OverrideLock(
            oldLk.Id, oldLk.Version + 99, StaffId.New(), CaseId.New(), Lease, clock);

        act.Should().Throw<LockPreconditionFailedError>();
    }

    [Fact]
    public void ExpireLock_AfterLeaseElapsed_TransitionsToIdle()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);
        device.ClearDomainEvents();

        clock.Advance(Lease + TimeSpan.FromSeconds(1));
        device.ExpireLock(lk.Id, clock);

        device.IsBusy.Should().BeFalse();
        device.DomainEvents.OfType<LockExpired>().Single().LockId.Should().Be(lk.Id);
    }

    [Fact]
    public void ExpireLock_BeforeLeaseElapsed_Throws()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);

        clock.Advance(Lease - TimeSpan.FromSeconds(1));
        var act = () => device.ExpireLock(lk.Id, clock);

        act.Should().Throw<LockLeaseNotExpiredError>();
        device.IsBusy.Should().BeTrue();
    }

    [Fact]
    public void ExpireLock_WrongLockId_Throws_PreconditionFailed()
    {
        var clock = new FakeClock();
        var device = KioskDeviceTestData.APairedDevice(clock: clock);
        device.AcquireLock(StaffId.New(), CaseId.New(), Lease, clock);
        clock.Advance(Lease + TimeSpan.FromSeconds(1));

        var act = () => device.ExpireLock(KioskLockId.New(), clock);

        act.Should().Throw<LockPreconditionFailedError>();
    }

    [Fact]
    public void ExpireLock_OnIdle_Throws_LockNotActive()
    {
        var device = KioskDeviceTestData.APairedDevice();
        var act = () => device.ExpireLock(KioskLockId.New(), new FakeClock());
        act.Should().Throw<LockNotActiveError>();
    }
}
