using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Persistence.Repositories;

internal sealed class StaffRepository(TicketsDbContext context) : IStaffRepository
{
    public Task<Staff?> FindByIdAsync(StaffId id, CancellationToken cancellationToken = default) =>
        context.Staff.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public Task<Staff?> FindByIdentityKeyAsync(IdentityKey key, CancellationToken cancellationToken = default) =>
        context.Staff.FirstOrDefaultAsync(s => s.IdentityKey == key, cancellationToken);

    public Task<Staff?> FindByEmailAsync(EmailAddress email, CancellationToken cancellationToken = default) =>
        context.Staff.FirstOrDefaultAsync(s => s.Email == email, cancellationToken);

    public async Task AddAsync(Staff staff, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(staff);
        await context.Staff.AddAsync(staff, cancellationToken).ConfigureAwait(false);
    }
}
