using Tickets.Application.Common;
using Tickets.Application.Devices.Dtos;
using Tickets.Application.Devices.Queries;
using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Handlers;

/// <summary>
/// Returns whether the supplied device id corresponds to a still-paired
/// device. Used by iPad cold-start before any credentials are available.
/// Never reveals the reason "not paired" (unknown vs unpaired); always
/// surfaces a boolean.
/// </summary>
public sealed class CheckPairingStatusHandler(IKioskDeviceRepository repository)
{
    public async Task<Result<PairingStatusDto>> HandleAsync(
        CheckPairingStatusQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (query.DeviceId == Guid.Empty)
        {
            return Result<PairingStatusDto>.Failure(
                AppError.Validation("deviceId is required."));
        }

        var device = await repository
            .FindByIdAsync(new DeviceId(query.DeviceId), cancellationToken)
            .ConfigureAwait(false);
        var isPaired = device is not null && device.IsPaired;
        return Result<PairingStatusDto>.Success(new PairingStatusDto(isPaired));
    }
}
