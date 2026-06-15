namespace Tickets.Domain.Devices;

/// <summary>
/// Aggregate-shaped repository contract. The Application layer only sees this
/// interface; the EF Core implementation lands in <c>Tickets.Infrastructure</c>
/// (Phase 3).
/// </summary>
public interface IKioskDeviceRepository
{
    Task<KioskDevice?> FindByIdAsync(DeviceId id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Find an active (Paired) device by its display name. Used by the pairing
    /// flow to enable "same-name re-pair" without forcing the operator to
    /// supply the existing deviceId (see api-pair.md Path B).
    /// </summary>
    Task<KioskDevice?> FindActiveByNameAsync(DeviceName name, CancellationToken cancellationToken = default);

    /// <summary>
    /// List paired devices, optionally filtered by <paramref name="mode"/>.
    /// Unpaired (soft-deleted) devices are never returned.
    /// </summary>
    Task<IReadOnlyList<KioskDevice>> ListPairedAsync(
        DeviceMode? mode,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Paired devices whose connectivity flag is <c>true</c> but whose last
    /// heartbeat predates <paramref name="cutoff"/>. Used by the background
    /// sweeper to surface candidates for <c>MarkDisconnected</c>. Returns
    /// tracked entities so the caller can mutate + commit in one scope.
    /// </summary>
    Task<IReadOnlyList<KioskDevice>> ListStaleConnectedAsync(
        DateTimeOffset cutoff,
        CancellationToken cancellationToken = default);

    Task AddAsync(KioskDevice device, CancellationToken cancellationToken = default);
}
