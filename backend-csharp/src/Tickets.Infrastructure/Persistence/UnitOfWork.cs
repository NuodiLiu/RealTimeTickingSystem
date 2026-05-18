using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;

namespace Tickets.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IUnitOfWork"/>. Translates the
/// EF-specific <see cref="DbUpdateConcurrencyException"/> into a domain
/// <see cref="ConcurrencyError"/> so handlers above can stay framework-free
/// (AGENTS.md §9.2).
/// </summary>
internal sealed class UnitOfWork(TicketsDbContext context) : IUnitOfWork
{
    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            // ex.Entries[0].Entity tells us which aggregate failed.
            var entity = ex.Entries.Count > 0 ? ex.Entries[0].Entity : null;
            var aggregateName = entity?.GetType().Name ?? "Aggregate";
            var aggregateId = ExtractIdentifier(entity);
            throw new ConcurrencyError(aggregateName, aggregateId);
        }
    }

    private static string ExtractIdentifier(object? entity)
    {
        if (entity is null)
        {
            return "<unknown>";
        }
        var idProp = entity.GetType().GetProperty("Id");
        return idProp?.GetValue(entity)?.ToString() ?? "<unknown>";
    }
}
