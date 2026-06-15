namespace Tickets.Domain.Shared.Events;

/// <summary>
/// Base for all domain events. Aggregates append events to an internal list during
/// state transitions; the Application layer dispatches them AFTER successful commit
/// (AGENTS.md §9.3 — never dispatch before SaveChanges succeeds).
/// </summary>
public abstract record DomainEvent(DateTimeOffset OccurredAt);
