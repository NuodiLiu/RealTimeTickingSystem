using Microsoft.Extensions.Logging;
using Tickets.Application.Common;
using Tickets.Application.SignalR.Commands;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.SignalR.Handlers;

public sealed class MarkDeviceDisconnectedHandler(
    IKioskDeviceRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    ILogger<MarkDeviceDisconnectedHandler> logger)
{
    public async Task<Result> HandleAsync(
        MarkDeviceDisconnectedCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var deviceId = new DeviceId(command.DeviceId);
        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            logger.LogWarning(
                "SignalR disconnected webhook for unknown device {DeviceId}", deviceId);
            return Result.Success();
        }

        // MarkDisconnected is idempotent and never touches the lock —
        // background lease expiry handles lock cleanup.
        device.MarkDisconnected(clock);

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
