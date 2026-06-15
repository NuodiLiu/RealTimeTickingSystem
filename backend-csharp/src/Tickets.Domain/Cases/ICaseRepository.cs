namespace Tickets.Domain.Cases;

/// <summary>
/// Aggregate-shaped repository contract. Implementation lands in
/// <c>Tickets.Infrastructure</c> (Phase 3) backed by EF Core.
/// </summary>
public interface ICaseRepository
{
    Task<Case?> FindByIdAsync(CaseId id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Pick the oldest <see cref="CaseStatus.Queued"/> case (FIFO). Used by
    /// the "take next" command. Returns <c>null</c> if the queue is empty.
    /// </summary>
    Task<Case?> FindOldestQueuedAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Case>> ListByStatusAsync(
        CaseStatus status,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task AddAsync(Case theCase, CancellationToken cancellationToken = default);

    /// <summary>
    /// Bounded query used by export endpoints. <paramref name="maxRows"/> is
    /// the hard cap — handlers should reject any export request above it
    /// (api-excel.md pitfall #1 fix).
    /// </summary>
    Task<IReadOnlyList<Case>> QueryForExportAsync(
        CaseExportFilters filters,
        int maxRows,
        CancellationToken cancellationToken = default);
}
