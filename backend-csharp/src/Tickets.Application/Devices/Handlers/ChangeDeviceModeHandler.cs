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

/// <summary>
/// Switches a device's mode. Fixes api-device.md pitfall #6 (legacy
/// asymmetric SignalR error handling): every notification is wrapped in a
/// try/catch so transport failure does NOT turn a 200 into a 500.
/// Also fixes pitfall #9 (no mode-value validation) — the input string is
/// strict-parsed before the aggregate is touched.
/// </summary>
public sealed class ChangeDeviceModeHandler(
    IKioskDeviceRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<ChangeDeviceModeHandler> logger)
{
    public async Task<Result<DeviceDto>> HandleAsync(
        ChangeDeviceModeCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is null)
        {
            return Result<DeviceDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        if (!Enum.TryParse<DeviceMode>(command.Mode, ignoreCase: true, out var mode))
        {
            return Result<DeviceDto>.Failure(
                AppError.Validation("mode must be 'Registration' or 'Feedback'."));
        }

        var deviceId = new DeviceId(command.DeviceId);
        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<DeviceDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        try
        {
            device.ChangeMode(mode, clock);
        }
        catch (DomainError ex)
        {
            return Result<DeviceDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        await SafeBroadcastAsync(device, cancellationToken).ConfigureAwait(false);
        await SafePushToDeviceAsync(device, mode, cancellationToken).ConfigureAwait(false);

        return Result<DeviceDto>.Success(DeviceDto.From(device));
    }

    private async Task SafeBroadcastAsync(KioskDevice device, CancellationToken ct)
    {
        try
        {
            await notifications.NotifyDashboardAsync(
                "device:mode_changed",
                new { deviceId = device.Id.Value, mode = device.Mode.ToString() },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Dashboard notification for device:mode_changed failed for {DeviceId}", device.Id);
        }
    }

    private async Task SafePushToDeviceAsync(KioskDevice device, DeviceMode mode, CancellationToken ct)
    {
        try
        {
            await notifications.PushToDeviceAsync(
                device.Id,
                "changeMode",
                new { mode = mode.ToString() },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Device push for changeMode failed for {DeviceId}", device.Id);
        }
    }
}
