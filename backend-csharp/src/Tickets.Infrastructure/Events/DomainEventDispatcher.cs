using System.Collections.Concurrent;
using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Domain.Shared.Events;

namespace Tickets.Infrastructure.Events;

/// <summary>
/// Reflection-backed dispatcher. For each event, locates registered
/// <c>IDomainEventHandler&lt;TConcreteEvent&gt;</c> services through the
/// scope's <c>IServiceProvider</c> and invokes them sequentially. Handler
/// exceptions are caught and logged so one broken consumer cannot block the
/// others or escape past the originating <c>UnitOfWork.CommitAsync</c>.
/// </summary>
internal sealed class DomainEventDispatcher(
    IServiceProvider serviceProvider,
    ILogger<DomainEventDispatcher> logger)
    : IDomainEventDispatcher
{
    // Cached per concrete event type: the closed IDomainEventHandler<TEvent>
    // service type plus the MethodInfo for HandleAsync(TEvent, CancellationToken).
    private static readonly ConcurrentDictionary<Type, DispatchPlan> Plans = new();

    public async Task DispatchAsync(
        IReadOnlyList<DomainEvent> events,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(events);
        if (events.Count == 0)
        {
            return;
        }

        foreach (var @event in events)
        {
            var plan = Plans.GetOrAdd(@event.GetType(), BuildPlan);
            // GetServices(serviceType) returns IEnumerable<object?> populated
            // by every registered implementation of that exact service type.
            var handlers = serviceProvider.GetServices(plan.HandlerType);

            foreach (var handler in handlers)
            {
                if (handler is null)
                {
                    continue;
                }

                try
                {
                    var task = (Task)plan.HandleMethod.Invoke(handler, new object[] { @event, cancellationToken })!;
                    await task.ConfigureAwait(false);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(
                        ex,
                        "Domain event handler {HandlerType} failed for {EventType}",
                        handler.GetType().Name,
                        @event.GetType().Name);
                }
            }
        }
    }

    private static DispatchPlan BuildPlan(Type eventType)
    {
        var handlerInterface = typeof(IDomainEventHandler<>).MakeGenericType(eventType);
        var method = handlerInterface.GetMethod(
            "HandleAsync",
            BindingFlags.Instance | BindingFlags.Public)
            ?? throw new InvalidOperationException(
                $"IDomainEventHandler<{eventType.Name}>.HandleAsync not found.");
        return new DispatchPlan(handlerInterface, method);
    }

    private sealed record DispatchPlan(Type HandlerType, MethodInfo HandleMethod);
}
