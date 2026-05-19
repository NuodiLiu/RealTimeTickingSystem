using Tickets.Domain.Shared.Events;

namespace Tickets.Application.Abstractions;

/// <summary>
/// Open-generic consumer of a single domain-event type. Multiple handlers can
/// be registered for the same event; the <see cref="IDomainEventDispatcher"/>
/// invokes each one independently and isolates failures.
/// </summary>
public interface IDomainEventHandler<in TEvent>
    where TEvent : DomainEvent
{
    Task HandleAsync(TEvent @event, CancellationToken cancellationToken);
}
