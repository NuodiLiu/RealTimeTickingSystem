using Tickets.Domain.Shared.ValueObjects;

namespace Tickets.Domain.Staff;

/// <summary>
/// Aggregate-shaped repository contract. Implementations live in
/// <c>Tickets.Infrastructure</c> (Phase 3). The Application layer only sees this
/// interface, so handler tests can substitute an in-memory fake.
/// </summary>
public interface IStaffRepository
{
    Task<Staff?> FindByIdAsync(StaffId id, CancellationToken cancellationToken = default);
    Task<Staff?> FindByIdentityKeyAsync(IdentityKey key, CancellationToken cancellationToken = default);
    Task<Staff?> FindByEmailAsync(EmailAddress email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Tracks a new aggregate. Persisted on the next <c>IUnitOfWork.CommitAsync</c>.
    /// </summary>
    Task AddAsync(Staff staff, CancellationToken cancellationToken = default);
}
