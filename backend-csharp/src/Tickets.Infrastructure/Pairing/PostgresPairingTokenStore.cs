using Microsoft.EntityFrameworkCore;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Entities;

namespace Tickets.Infrastructure.Pairing;

/// <summary>
/// Postgres-backed one-time pairing-token ledger. Persists the
/// <c>(token, expireAt, consumedAt)</c> tuple in the <c>pairing_tokens</c>
/// table and consumes a token via a single atomic <c>UPDATE</c> that only
/// matches a pending, unexpired row — so a token can be redeemed at most once
/// even under concurrent <c>/pair/complete</c> calls (api-pair.md pitfall #2).
/// <para>
/// Registered <em>scoped</em>: it shares the per-request
/// <see cref="TicketsDbContext"/>.
/// </para>
/// </summary>
internal sealed class PostgresPairingTokenStore(TicketsDbContext context, IClock clock)
    : IPairingTokenStore
{
    public async Task SaveAsync(
        string token, DateTimeOffset expireAt, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);

        context.PairingTokens.Add(new PairingTokenEntry
        {
            Token = token,
            ExpireAt = expireAt,
            ConsumedAt = null,
            CreatedAt = clock.UtcNow,
        });

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<bool> ConsumeAsync(
        string token, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);

        // Single atomic statement:
        //   UPDATE pairing_tokens SET consumed_at = now
        //   WHERE token = @token AND consumed_at IS NULL AND expire_at > now;
        // ExecuteUpdateAsync returns the affected row count, so a return of 1
        // means we won the race (pending + unexpired); 0 means unknown,
        // expired, or already consumed.
        var affected = await context.PairingTokens
            .Where(t => t.Token == token && t.ConsumedAt == null && t.ExpireAt > now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(t => t.ConsumedAt, now),
                cancellationToken)
            .ConfigureAwait(false);

        return affected == 1;
    }
}
