using System.Collections.Concurrent;
using System.Security.Cryptography;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Identity;

/// <summary>
/// Process-local refresh-handle ledger. Sufficient for single-instance dev
/// and integration tests; Phase 5 should replace with a Postgres-backed
/// store (sticky cookie + cluster-shared state).
/// </summary>
internal sealed class InMemoryRefreshHandleStore : IRefreshHandleStore
{
    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.Ordinal);

    public Task<string> IssueAsync(
        StaffId staffId, DateTimeOffset expireAt, CancellationToken cancellationToken = default)
    {
        var handle = NewHandle();
        _entries[handle] = new Entry(staffId, expireAt);
        return Task.FromResult(handle);
    }

    public Task<RefreshHandleRecord?> FindAsync(
        string handle, DateTimeOffset asOf, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(handle);
        if (!_entries.TryGetValue(handle, out var entry))
        {
            return Task.FromResult<RefreshHandleRecord?>(null);
        }
        if (entry.ExpireAt <= asOf)
        {
            _entries.TryRemove(handle, out _);
            return Task.FromResult<RefreshHandleRecord?>(null);
        }
        return Task.FromResult<RefreshHandleRecord?>(new RefreshHandleRecord(entry.StaffId, entry.ExpireAt));
    }

    public Task DeleteAsync(string handle, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(handle))
        {
            _entries.TryRemove(handle, out _);
        }
        return Task.CompletedTask;
    }

    public Task<string?> RotateAsync(
        string oldHandle,
        DateTimeOffset asOf,
        DateTimeOffset newExpireAt,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(oldHandle);
        if (!_entries.TryRemove(oldHandle, out var entry) || entry.ExpireAt <= asOf)
        {
            return Task.FromResult<string?>(null);
        }
        var newHandle = NewHandle();
        _entries[newHandle] = new Entry(entry.StaffId, newExpireAt);
        return Task.FromResult<string?>(newHandle);
    }

    private static string NewHandle()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private sealed record Entry(StaffId StaffId, DateTimeOffset ExpireAt);
}
