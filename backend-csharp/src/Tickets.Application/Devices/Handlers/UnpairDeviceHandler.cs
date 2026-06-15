using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Commands;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Devices.Handlers;

/// <summary>
/// Staff unpairs a device (legacy <c>DELETE /device/{id}</c>). Aggregate
/// rejects if busy or already unpaired. After commit pushes <c>UNPAIRED</c>
/// to the iPad so its app exits to the pairing screen, and broadcasts
/// <c>device:unpaired</c> to dashboards.
/// </summary>
public sealed class UnpairDeviceHandler(
    IKioskDeviceRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<UnpairDeviceHandler> logger)
{
    public async Task<Result> HandleAsync(
        UnpairDeviceCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is null)
        {
            return Result.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var deviceId = new DeviceId(command.DeviceId);
        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        try
        {
            device.Unpair(clock);
        }
        catch (DomainError ex)
        {
            return Result.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            await notifications.PushToDeviceAsync(
                device.Id, "UNPAIRED", new { }, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UNPAIRED push failed for {DeviceId}", device.Id);
        }

        try
        {
            await notifications.NotifyDashboardAsync(
                "device:unpaired",
                new { deviceId = device.Id.Value },
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "device:unpaired push failed for {DeviceId}", device.Id);
        }

        return Result.Success();
    }
}
