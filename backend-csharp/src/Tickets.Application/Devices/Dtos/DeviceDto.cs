using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Dtos;

/// <summary>
/// HTTP-facing snapshot of a <see cref="KioskDevice"/>. Names mirror the
/// legacy <c>GET /device</c> response (api-device.md).
/// </summary>
public sealed record DeviceDto(
    Guid Id,
    string Name,
    string Mode,
    string PairingStatus,
    bool IsConnected,
    DateTimeOffset LastSeenAt,
    bool IsBusy,
    Guid? CurrentLockId,
    uint? CurrentLockVersion,
    Guid? CurrentLockCaseId)
{
    public static DeviceDto From(KioskDevice device)
    {
        ArgumentNullException.ThrowIfNull(device);
        return new DeviceDto(
            Id: device.Id.Value,
            Name: device.Name.Value,
            Mode: device.Mode.ToString(),
            PairingStatus: device.PairingStatus.ToString(),
            IsConnected: device.IsConnected,
            LastSeenAt: device.LastSeenAt,
            IsBusy: device.IsBusy,
            CurrentLockId: device.CurrentLock?.Id.Value,
            CurrentLockVersion: device.CurrentLock?.Version,
            CurrentLockCaseId: device.CurrentLock?.CaseId.Value);
    }
}
