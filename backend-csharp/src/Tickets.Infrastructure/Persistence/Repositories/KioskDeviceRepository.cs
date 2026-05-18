using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Persistence.Repositories;

internal sealed class KioskDeviceRepository(TicketsDbContext context) : IKioskDeviceRepository
{
    public Task<KioskDevice?> FindByIdAsync(DeviceId id, CancellationToken cancellationToken = default) =>
        context.Devices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

    public Task<KioskDevice?> FindActiveByNameAsync(
        DeviceName name, CancellationToken cancellationToken = default) =>
        context.Devices
            .FirstOrDefaultAsync(
                d => d.Name == name && d.PairingStatus == PairingStatus.Paired,
                cancellationToken);

    public async Task AddAsync(KioskDevice device, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(device);
        await context.Devices.AddAsync(device, cancellationToken).ConfigureAwait(false);
    }
}
