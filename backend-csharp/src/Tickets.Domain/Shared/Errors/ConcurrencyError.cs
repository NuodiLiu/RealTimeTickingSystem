namespace Tickets.Domain.Shared.Errors;

/// <summary>
/// Raised by repositories when the optimistic concurrency check fails
/// (EF Core <c>DbUpdateConcurrencyException</c>). Translated to HTTP 409 by WebApi.
/// </summary>
public sealed class ConcurrencyError : DomainError
{
    public string AggregateName { get; }
    public string AggregateId { get; }

    public ConcurrencyError(string aggregateName, string aggregateId)
        : base("concurrency_conflict",
               $"{aggregateName} {aggregateId} was modified by another writer; reload and retry.")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(aggregateName);
        ArgumentException.ThrowIfNullOrWhiteSpace(aggregateId);
        AggregateName = aggregateName;
        AggregateId = aggregateId;
    }
}
