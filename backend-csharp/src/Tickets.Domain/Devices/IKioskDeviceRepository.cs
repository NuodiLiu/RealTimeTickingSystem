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

    Task AddAsync(KioskDevice device, CancellationToken cancellationToken = default);
}
