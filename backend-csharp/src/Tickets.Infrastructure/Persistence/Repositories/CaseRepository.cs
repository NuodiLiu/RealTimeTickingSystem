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

    public async Task<IReadOnlyList<Case>> QueryForExportAsync(
        CaseExportFilters filters,
        int maxRows,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filters);

        var query = context.Cases.AsQueryable();

        if (filters.Statuses is { Count: > 0 } statuses)
        {
            var arr = statuses.ToArray();
            query = query.Where(c => arr.Contains(c.Status));
        }
        if (filters.StartDate is { } start)
        {
            query = query.Where(c => c.CreatedAt >= start);
        }
        if (filters.EndDate is { } end)
        {
            query = query.Where(c => c.CreatedAt <= end);
        }
        if (filters.StaffId is { } staffId)
        {
            query = query.Where(c => c.AssignedStaffId == staffId);
        }
        if (!string.IsNullOrWhiteSpace(filters.Category))
        {
            var category = Category.Parse(filters.Category);
            query = query.Where(c => c.Category == category);
        }

        var rows = await query
            .OrderByDescending(c => c.CreatedAt)
            .Take(maxRows)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return rows;
    }
}
