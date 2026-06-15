using Tickets.Application.Common.Json;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Devices.Dtos;

/// <summary>
/// HTTP-facing snapshot of a <see cref="KioskDevice"/> for the dashboard's
/// <c>GET /device</c> list. Field names + casing mirror the EXISTING frontend
/// contract (frontend/src/app/hooks/useDevices.ts and the
/// <c>DevicesListItem</c> type in api.ts):
/// <list type="bullet">
///   <item><c>deviceId</c> — NOT <c>id</c>.</item>
///   <item><c>isOnline</c> — NOT <c>isConnected</c>.</item>
///   <item><c>status</c> — derived OFFLINE / IDLE / BUSY tile state.</item>
///   <item><c>currentLock</c> — nested object (or <c>null</c>), NOT flat
///   <c>currentLockId</c>/<c>currentLockVersion</c> fields.</item>
/// </list>
/// <para>
/// <see cref="Mode"/> and <see cref="Status"/> serialize to the legacy
/// UPPER_SNAKE wire strings via the registered wire-enum converters.
/// </para>
/// </summary>
public sealed record DeviceDto(
    Guid DeviceId,
    string Name,
    DeviceMode Mode,
    DeviceStatus Status,
    bool IsOnline,
    DateTimeOffset LastSeenAt,
    DeviceLockDto? CurrentLock)
{
    /// <summary>
    /// Projects a device, computing <c>isOnline</c> / <c>status</c> against the
    /// supplied clock + offline threshold (matches the sweeper's definition of
    /// "online"). Lock case/staff enrichment is not available from the device
    /// aggregate alone — see the type remarks.
    /// </summary>
    public static DeviceDto From(KioskDevice device, IClock clock, TimeSpan offlineThreshold)
    {
        ArgumentNullException.ThrowIfNull(device);
        ArgumentNullException.ThrowIfNull(clock);

        var online = device.IsOnline(clock, offlineThreshold);
        // Priority OFFLINE > BUSY > IDLE (frontend useDevices.ts).
        var status = !online
            ? DeviceStatus.Offline
            : device.IsBusy
                ? DeviceStatus.Busy
                : DeviceStatus.Idle;

        return new DeviceDto(
            DeviceId: device.Id.Value,
            Name: device.Name.Value,
            Mode: device.Mode,
            Status: status,
            IsOnline: online,
            LastSeenAt: device.LastSeenAt,
            CurrentLock: DeviceLockDto.From(device.CurrentLock));
    }
}

/// <summary>
/// Nested <c>currentLock</c> shape the dashboard reads. The device aggregate
/// owns only the lock identity / lease — it does not join the related Case or
/// Staff, so the rich <c>case</c> (studentName, category, zID, status) and
/// <c>staffName</c> the frontend type also declares are NOT populated here.
/// FOLLOW-UP for the next agent: enrich via a read-model join if the dashboard
/// needs the busy-tile student name without a separate /cases fetch.
/// </summary>
public sealed record DeviceLockDto(
    Guid Id,
    uint Version,
    string Status,
    Guid CaseId,
    DateTimeOffset LeaseExpireAt)
{
    public static DeviceLockDto? From(KioskLock? lockEntity) =>
        lockEntity is null
            ? null
            : new DeviceLockDto(
                Id: lockEntity.Id.Value,
                Version: lockEntity.Version,
                // CurrentLock only exists while ACTIVE; past locks are events.
                Status: "ACTIVE",
                CaseId: lockEntity.CaseId.Value,
                LeaseExpireAt: lockEntity.LeaseExpireAt);
}
