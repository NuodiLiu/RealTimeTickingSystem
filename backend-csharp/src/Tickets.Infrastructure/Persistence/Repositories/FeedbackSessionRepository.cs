using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Infrastructure.Persistence.Repositories;

internal sealed class FeedbackSessionRepository(TicketsDbContext context) : IFeedbackSessionRepository
{
    public Task<FeedbackSession?> FindByIdAsync(
        FeedbackSessionId id, CancellationToken cancellationToken = default) =>
        context.FeedbackSessions.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public Task<FeedbackSession?> FindActiveByCaseAsync(
        CaseId caseId, CancellationToken cancellationToken = default) =>
        context.FeedbackSessions
            .Where(s => s.CaseId == caseId &&
                        (s.Status == FeedbackSessionStatus.Created ||
                         s.Status == FeedbackSessionStatus.Delivered))
            .FirstOrDefaultAsync(cancellationToken);

    public Task<FeedbackSession?> FindActiveByDeviceAsync(
        DeviceId deviceId, CancellationToken cancellationToken = default) =>
        context.FeedbackSessions
            .Where(s => s.DeviceId == deviceId &&
                        (s.Status == FeedbackSessionStatus.Created ||
                         s.Status == FeedbackSessionStatus.Delivered))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<FeedbackSession>> FindExpiredAsync(
        DateTimeOffset asOf, int maxResults, CancellationToken cancellationToken = default)
    {
        // OR-predicate inline (rather than a helper method or array.Contains)
        // because EF Core only translates the standard query operators applied
        // directly inside the lambda, not user-defined static helpers, and
        // .NET 10's collection-expression Contains routes through ReadOnlySpan
        // which the LINQ funcletizer cannot evaluate.
        var rows = await context.FeedbackSessions
            .Where(s => (s.Status == FeedbackSessionStatus.Created ||
                         s.Status == FeedbackSessionStatus.Delivered) &&
                        s.ExpireAt <= asOf)
            .OrderBy(s => s.ExpireAt)
            .Take(maxResults)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return rows;
    }

    public async Task AddAsync(FeedbackSession session, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(session);
        await context.FeedbackSessions.AddAsync(session, cancellationToken).ConfigureAwait(false);
    }
}
