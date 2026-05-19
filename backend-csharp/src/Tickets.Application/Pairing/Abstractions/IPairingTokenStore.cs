namespace Tickets.Application.Pairing.Abstractions;

/// <summary>
/// Server-side ledger of one-time pairing tokens. A token is issued by
/// <c>/pair/generate-qr</c>, written into this store with a TTL, and consumed
/// by <c>/pair/complete</c>. <see cref="ConsumeAsync"/> MUST be atomic — the
/// implementation typically does a CAS update so the token can be consumed
/// at most once (api-pair.md pitfall #2).
/// <para>
/// Phase 5 Infrastructure will back this with a Postgres table; Phase 4
/// integration tests inject a fake.
/// </para>
/// </summary>
public interface IPairingTokenStore
{
    /// <summary>
    /// Stores the freshly minted token with its expiry. Caller already
    /// generated the token via <see cref="IPairingTokenGenerator"/>.
    /// </summary>
    Task SaveAsync(string token, DateTimeOffset expireAt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically marks a token as consumed. Returns <c>true</c> if the token
    /// existed, was still pending and not expired; returns <c>false</c>
    /// otherwise (unknown, expired, or already consumed).
    /// </summary>
    Task<bool> ConsumeAsync(string token, DateTimeOffset now, CancellationToken cancellationToken = default);
}
