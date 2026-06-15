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

    public async Task<IReadOnlyList<KioskDevice>> ListPairedAsync(
        DeviceMode? mode,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = context.Devices.Where(d => d.PairingStatus == PairingStatus.Paired);
        if (mode is { } m)
        {
            query = query.Where(d => d.Mode == m);
        }
        var rows = await query
            .OrderByDescending(d => d.LastSeenAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return rows;
    }

    public async Task<IReadOnlyList<KioskDevice>> ListStaleConnectedAsync(
        DateTimeOffset cutoff,
        CancellationToken cancellationToken = default)
    {
        var rows = await context.Devices
            .Where(d => d.PairingStatus == PairingStatus.Paired
                && d.IsConnected
                && d.LastSeenAt < cutoff)
            .OrderBy(d => d.LastSeenAt)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return rows;
    }

    public async Task AddAsync(KioskDevice device, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(device);
        await context.Devices.AddAsync(device, cancellationToken).ConfigureAwait(false);
    }
}
