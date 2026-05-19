using System.Collections.Concurrent;
using Tickets.Application.Pairing.Abstractions;

namespace Tickets.Infrastructure.Pairing;

/// <summary>
/// In-memory token ledger. Sufficient for single-process tests and dev, but
/// loses state across restarts and across multiple instances. Phase 5 should
/// replace with a Postgres-backed implementation that persists the
/// (token, expireAt, consumedAt) tuple and uses a CAS update for
/// <see cref="ConsumeAsync"/>.
/// </summary>
internal sealed class InMemoryPairingTokenStore : IPairingTokenStore
{
    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.Ordinal);

    public Task SaveAsync(string token, DateTimeOffset expireAt, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);
        _entries[token] = new Entry(expireAt, Consumed: false);
        return Task.CompletedTask;
    }

    public Task<bool> ConsumeAsync(string token, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);

        // Pseudo-CAS: snapshot existing, then attempt atomic replace.
        if (!_entries.TryGetValue(token, out var entry))
        {
            return Task.FromResult(false);
        }
        if (entry.Consumed || entry.ExpireAt <= now)
        {
            return Task.FromResult(false);
        }

        var consumed = entry with { Consumed = true };
        var swapped = _entries.TryUpdate(token, consumed, entry);
        return Task.FromResult(swapped);
    }

    private sealed record Entry(DateTimeOffset ExpireAt, bool Consumed);
}
