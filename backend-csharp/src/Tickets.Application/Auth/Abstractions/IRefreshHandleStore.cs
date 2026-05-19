using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Abstractions;

/// <summary>
/// Server-side ledger of opaque refresh handles. Each handle is one-time —
/// <see cref="RotateAsync"/> atomically swaps the supplied old handle for a
/// freshly minted one, so an attacker replaying a stolen handle is locked
/// out the moment the legitimate client refreshes. Mirrors the Node
/// <c>refreshStore</c> behaviour at backend/src/lib/refresh-store.ts.
/// </summary>
public interface IRefreshHandleStore
{
    Task<string> IssueAsync(
        StaffId staffId,
        DateTimeOffset expireAt,
        CancellationToken cancellationToken = default);

    Task<RefreshHandleRecord?> FindAsync(
        string handle,
        DateTimeOffset asOf,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(string handle, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically retire <paramref name="oldHandle"/> and emit a new one for
    /// the same staff. Returns <c>null</c> if the old handle is unknown,
    /// expired, or already rotated.
    /// </summary>
    Task<string?> RotateAsync(
        string oldHandle,
        DateTimeOffset asOf,
        DateTimeOffset newExpireAt,
        CancellationToken cancellationToken = default);
}

public sealed record RefreshHandleRecord(StaffId StaffId, DateTimeOffset ExpireAt);
