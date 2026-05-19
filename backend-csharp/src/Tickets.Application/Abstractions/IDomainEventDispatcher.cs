using Tickets.Domain.Shared.Events;

namespace Tickets.Application.Abstractions;

/// <summary>
/// Post-commit dispatcher for domain events. Called by <c>UnitOfWork</c>
/// after <c>SaveChangesAsync</c> succeeds — never before (AGENTS.md §9.3).
/// Implementations MUST isolate handler failures so a broken consumer can
/// never roll back a successful business commit.
/// </summary>
public interface IDomainEventDispatcher
{
    Task DispatchAsync(IReadOnlyList<DomainEvent> events, CancellationToken cancellationToken);
}
