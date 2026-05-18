using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Devices;

/// <summary>
/// Object Mother for <see cref="KioskDevice"/> tests (AGENTS.md §5.5).
/// </summary>
internal static class KioskDeviceTestData
{
    public static readonly TimeSpan DefaultLease = TimeSpan.FromSeconds(60);

    public static SecretHash ASecret(string raw = "deadbeef") => SecretHash.FromRaw(raw);
    public static DeviceName AName(string raw = "Kiosk-01") => DeviceName.Parse(raw);
    public static IClock AClock() => new FakeClock();

    public static KioskDevice APairedDevice(
        DeviceMode mode = DeviceMode.Registration,
        IClock? clock = null) =>
        KioskDevice.Pair(AName(), ASecret(), mode, clock ?? AClock());

    public static KioskDevice AnUnpairedDevice(IClock? clock = null)
    {
        var c = clock ?? AClock();
        var device = APairedDevice(clock: c);
        device.Unpair(c);
        return device;
    }

    public static KioskDevice ABusyDevice(
        out KioskLockId lockId,
        DeviceMode mode = DeviceMode.Registration,
        IClock? clock = null)
    {
        var c = clock ?? AClock();
        var device = APairedDevice(mode, c);
        var lk = device.AcquireLock(StaffId.New(), CaseId.New(), DefaultLease, c);
        lockId = lk.Id;
        return device;
    }
}
