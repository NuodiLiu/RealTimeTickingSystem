using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Shared.Aggregates;

/// <summary>
/// Base for aggregate roots. Provides the domain event buffer and the optimistic
/// concurrency version. EF Core configures <see cref="Version"/> as a concurrency
/// token in <c>Tickets.Infrastructure</c> (AGENTS.md §9.2).
/// </summary>
public abstract class AggregateRoot
{
    private readonly List<DomainEvent> _events = [];

    /// <summary>Optimistic concurrency token, incremented on every state mutation.</summary>
    public uint Version { get; protected set; }

    /// <summary>Pending events to dispatch after successful commit.</summary>
    public IReadOnlyList<DomainEvent> DomainEvents => _events;

    protected void RaiseEvent(DomainEvent @event) => _events.Add(@event);

    /// <summary>
    /// Called by repositories/UoW after successful commit. Domain code does NOT call this.
    /// </summary>
    public void ClearDomainEvents() => _events.Clear();

    /// <summary>
    /// Bump the concurrency version. Every state-changing method MUST end with this call.
    /// </summary>
    protected void BumpVersion() => Version++;
}
