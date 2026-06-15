using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;

namespace Tickets.Infrastructure.Tests.Persistence;

[Collection("postgres")]
public sealed class KioskDeviceRepositoryTests(PostgresFixture fixture)
{
    private static KioskDevice APairedDevice(IClock clock, string name = "Kiosk-01") =>
        KioskDevice.Pair(
            DeviceName.Parse(name),
            SecretHash.FromRaw("deadbeef"),
            DeviceMode.Registration,
            clock);

    [Fact]
    public async Task Add_ThenFindById_RoundTripsIdleDevice()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var device = APairedDevice(clock, name: "Kiosk-A");

        await using (var ctx = fixture.CreateContext())
        {
            await new KioskDeviceRepository(ctx).AddAsync(device);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new KioskDeviceRepository(verifyCtx).FindByIdAsync(device.Id);

        loaded.Should().NotBeNull();
        loaded!.Id.Should().Be(device.Id);
        loaded.Name.Should().Be(device.Name);
        loaded.Mode.Should().Be(DeviceMode.Registration);
        loaded.PairingStatus.Should().Be(PairingStatus.Paired);
        loaded.IsBusy.Should().BeFalse();
        loaded.CurrentLock.Should().BeNull();
    }

    /// <summary>
    /// Round-trips the OwnsOne KioskLock embedded entity. Verifies all six
    /// current_lock_* columns persist and re-materialise into a single
    /// in-memory <see cref="KioskLock"/>.
    /// </summary>
    [Fact]
    public async Task Add_BusyDevice_RoundTripsCurrentLock()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var device = APairedDevice(clock, name: "Kiosk-B");
        var staffId = StaffId.New();
        var caseId = CaseId.New();
        var acquired = device.AcquireLock(staffId, caseId, TimeSpan.FromMinutes(1), clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new KioskDeviceRepository(ctx).AddAsync(device);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new KioskDeviceRepository(verifyCtx).FindByIdAsync(device.Id);

        loaded!.IsBusy.Should().BeTrue();
        loaded.CurrentLock.Should().NotBeNull();
        loaded.CurrentLock!.Id.Should().Be(acquired.Id);
        loaded.CurrentLock.StaffId.Should().Be(staffId);
        loaded.CurrentLock.CaseId.Should().Be(caseId);
        loaded.CurrentLock.Version.Should().Be(1);
        loaded.CurrentLock.LeaseExpireAt.Should().BeCloseTo(
            acquired.LeaseExpireAt, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task CompleteLock_PersistsTransitionAndClearsEmbeddedLock()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var device = APairedDevice(clock, name: "Kiosk-C");
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), TimeSpan.FromMinutes(1), clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new KioskDeviceRepository(ctx).AddAsync(device);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using (var ctx = fixture.CreateContext())
        {
            var loaded = await new KioskDeviceRepository(ctx).FindByIdAsync(device.Id);
            loaded!.CompleteLock(loaded.CurrentLock!.Id, loaded.CurrentLock.Version, clock);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var post = await new KioskDeviceRepository(verifyCtx).FindByIdAsync(device.Id);
        post!.IsBusy.Should().BeFalse();
        post.CurrentLock.Should().BeNull();
    }

    [Fact]
    public async Task FindActiveByName_IgnoresUnpairedDevices()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var unpaired = APairedDevice(clock, name: "Kiosk-Shared");
        unpaired.Unpair(clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new KioskDeviceRepository(ctx).AddAsync(unpaired);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var found = await new KioskDeviceRepository(verifyCtx)
            .FindActiveByNameAsync(DeviceName.Parse("Kiosk-Shared"));

        found.Should().BeNull();
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }
}
