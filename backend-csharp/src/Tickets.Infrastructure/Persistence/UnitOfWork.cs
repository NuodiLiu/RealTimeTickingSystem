using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Aggregates;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Events;

namespace Tickets.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IUnitOfWork"/>. Translates the
/// EF-specific <see cref="DbUpdateConcurrencyException"/> into a domain
/// <see cref="ConcurrencyError"/> so handlers above can stay framework-free
/// (AGENTS.md §9.2).
/// <para>
/// After a successful <c>SaveChangesAsync</c>, dispatches any domain events
/// that the tracked aggregates accumulated. Dispatcher exceptions are
/// swallowed and logged — a broken consumer must never roll back a
/// successful business commit (AGENTS.md §9.3, §7 #6). Both the dispatcher
/// and the logger are optional so legacy tests can construct
/// <c>new UnitOfWork(context)</c> directly without DI.
/// </para>
/// </summary>
internal sealed class UnitOfWork(
    TicketsDbContext context,
    IDomainEventDispatcher? dispatcher = null,
    ILogger<UnitOfWork>? logger = null)
    : IUnitOfWork
{
    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        var dirtyAggregates = context.ChangeTracker
            .Entries<AggregateRoot>()
            .Select(e => e.Entity)
            .Where(a => a.DomainEvents.Count > 0)
            .ToList();

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

        if (dirtyAggregates.Count == 0)
        {
            return;
        }

        var events = dirtyAggregates
            .SelectMany(a => a.DomainEvents)
            .ToList();

        foreach (var aggregate in dirtyAggregates)
        {
            aggregate.ClearDomainEvents();
        }

        if (dispatcher is null || events.Count == 0)
        {
            return;
        }

        try
        {
            await dispatcher.DispatchAsync(events, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger?.LogError(
                ex,
                "Domain event dispatch failed after commit ({EventCount} events).",
                events.Count);
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
