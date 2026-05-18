using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Cases;

namespace Tickets.Infrastructure.Persistence.Repositories;

internal sealed class CaseRepository(TicketsDbContext context) : ICaseRepository
{
    public Task<Case?> FindByIdAsync(CaseId id, CancellationToken cancellationToken = default) =>
        context.Cases.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Case?> FindOldestQueuedAsync(CancellationToken cancellationToken = default) =>
        context.Cases
            .Where(c => c.Status == CaseStatus.Queued)
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Id)   // tiebreaker for ties at the millisecond
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<Case>> ListByStatusAsync(
        CaseStatus status,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var rows = await context.Cases
            .Where(c => c.Status == status)
            .OrderBy(c => c.CreatedAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return rows;
    }

    public async Task AddAsync(Case theCase, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(theCase);
        await context.Cases.AddAsync(theCase, cancellationToken).ConfigureAwait(false);
    }
}
