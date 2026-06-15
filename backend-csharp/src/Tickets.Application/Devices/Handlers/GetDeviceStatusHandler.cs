using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Dtos;
using Tickets.Application.Devices.Queries;
using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Handlers;

public sealed class GetDeviceStatusHandler(
    IKioskDeviceRepository repository,
    ICurrentDevice currentDevice)
{
    public async Task<Result<DeviceDto>> HandleAsync(
        GetDeviceStatusQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentDevice.DeviceId is not { } deviceId)
        {
            return Result<DeviceDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Device authentication required."));
        }

        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<DeviceDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        return Result<DeviceDto>.Success(DeviceDto.From(device));
    }
}
