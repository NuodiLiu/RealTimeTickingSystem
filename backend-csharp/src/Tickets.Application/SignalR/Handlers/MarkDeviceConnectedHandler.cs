using Microsoft.Extensions.Logging;
using Tickets.Application.Common;
using Tickets.Application.SignalR.Commands;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.SignalR.Handlers;

public sealed class MarkDeviceConnectedHandler(
    IKioskDeviceRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    ILogger<MarkDeviceConnectedHandler> logger)
{
    public async Task<Result> HandleAsync(
        MarkDeviceConnectedCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var deviceId = new DeviceId(command.DeviceId);
        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            // Webhook for a device we don't know about (e.g. one Azure already
            // forgot). Log + acknowledge so Azure stops retrying.
            logger.LogWarning(
                "SignalR connected webhook for unknown device {DeviceId}", deviceId);
            return Result.Success();
        }

        try
        {
            device.RecordHeartbeat(clock);
        }
        catch (DomainError ex)
        {
            // Unpaired device receiving SignalR traffic — log only; the
            // webhook is not an appropriate place to surface a 4xx.
            logger.LogWarning(ex,
                "SignalR connected webhook rejected for device {DeviceId}", deviceId);
            return Result.Success();
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
