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
/// Records a device heartbeat. Aggregate decides whether this transition
/// also flips the connection flag and raises
/// <c>DeviceConnectionStateChanged</c> (i.e. on the first heartbeat after a
/// disconnect).
/// </summary>
public sealed class RecordHeartbeatHandler(
    IKioskDeviceRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    ICurrentDevice currentDevice)
{
    public async Task<Result<HeartbeatResponseDto>> HandleAsync(
        RecordHeartbeatCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentDevice.DeviceId is not { } deviceId)
        {
            return Result<HeartbeatResponseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Device authentication required."));
        }

        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<HeartbeatResponseDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        try
        {
            device.RecordHeartbeat(clock);
        }
        catch (DomainError ex)
        {
            return Result<HeartbeatResponseDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        return Result<HeartbeatResponseDto>.Success(HeartbeatResponseDto.From(device, clock));
    }
}
