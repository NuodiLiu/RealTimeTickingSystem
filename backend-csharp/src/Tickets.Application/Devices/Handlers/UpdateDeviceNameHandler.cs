using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Dtos;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Devices.Handlers;

public sealed class UpdateDeviceNameHandler(
    IKioskDeviceRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<UpdateDeviceNameHandler> logger)
{
    public async Task<Result<UpdateDeviceNameResponseDto>> HandleAsync(
        UpdateDeviceNameCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is null)
        {
            return Result<UpdateDeviceNameResponseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        if (string.IsNullOrWhiteSpace(command.Name))
        {
            return Result<UpdateDeviceNameResponseDto>.Failure(AppError.Validation("name is required."));
        }

        var deviceId = new DeviceId(command.DeviceId);
        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<UpdateDeviceNameResponseDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        DeviceName parsed;
        try
        {
            parsed = DeviceName.Parse(command.Name);
            device.ChangeName(parsed, clock);
        }
        catch (DomainError ex)
        {
            return Result<UpdateDeviceNameResponseDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }
        catch (ArgumentException ex)
        {
            return Result<UpdateDeviceNameResponseDto>.Failure(AppError.Validation(ex.Message));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            await notifications.NotifyDashboardAsync(
                "device:renamed",
                new { id = device.Id.Value, name = device.Name.Value },
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "device:renamed push failed for {DeviceId}", device.Id);
        }

        return Result<UpdateDeviceNameResponseDto>.Success(UpdateDeviceNameResponseDto.From(device));
    }
}
