using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Configuration;
using Tickets.Application.Devices.Dtos;
using Tickets.Application.Devices.Queries;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Devices.Handlers;

public sealed class GetDeviceStatusHandler(
    IKioskDeviceRepository repository,
    ICurrentDevice currentDevice,
    IClock clock,
    IOptions<DeviceConnectivityOptions> connectivityOptions)
{
    private readonly TimeSpan _offlineThreshold = connectivityOptions.Value.OfflineThreshold;

    public async Task<Result<DeviceStatusDto>> HandleAsync(
        GetDeviceStatusQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentDevice.DeviceId is not { } deviceId)
        {
            return Result<DeviceStatusDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Device authentication required."));
        }

        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<DeviceStatusDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        return Result<DeviceStatusDto>.Success(new DeviceStatusDto(
            Ok: true,
            DeviceId: device.Id.Value,
            Mode: device.Mode,
            Online: device.IsOnline(clock, _offlineThreshold)));
    }
}
