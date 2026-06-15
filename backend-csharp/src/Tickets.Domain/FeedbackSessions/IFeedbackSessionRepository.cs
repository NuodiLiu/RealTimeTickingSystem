using Tickets.Domain.Cases;
using Tickets.Domain.Devices;

namespace Tickets.Domain.FeedbackSessions;

/// <summary>
/// Aggregate-shaped repository contract. EF Core implementation lives in
/// <c>Tickets.Infrastructure</c> (Phase 3).
/// </summary>
public interface IFeedbackSessionRepository
{
    Task<FeedbackSession?> FindByIdAsync(
        FeedbackSessionId id,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Find a session that is still active (Created or Delivered) for the given
    /// case. Used by feedback flows to detect duplicates / overrides.
    /// </summary>
    Task<FeedbackSession?> FindActiveByCaseAsync(
        CaseId caseId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Find a session that is still active for the given device. Used by the
    /// "device busy" pre-check in feedback.send.
    /// </summary>
    Task<FeedbackSession?> FindActiveByDeviceAsync(
        DeviceId deviceId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Find sessions whose <see cref="FeedbackSession.ExpireAt"/> has elapsed
    /// while still in Created/Delivered. Used by the background expiry sweep.
    /// </summary>
    Task<IReadOnlyList<FeedbackSession>> FindExpiredAsync(
        DateTimeOffset asOf,
        int maxResults,
        CancellationToken cancellationToken = default);

    Task AddAsync(FeedbackSession session, CancellationToken cancellationToken = default);
}
