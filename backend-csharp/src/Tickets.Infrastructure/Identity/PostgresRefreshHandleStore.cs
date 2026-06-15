using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Entities;

namespace Tickets.Infrastructure.Identity;

/// <summary>
/// Postgres-backed refresh-handle ledger. Each handle is one-time:
/// <see cref="RotateAsync"/> atomically retires the supplied handle and mints
/// a fresh one inside a transaction, so a replayed (stolen) handle is locked
/// out the moment the legitimate client refreshes. Mirrors the Node
/// <c>refreshStore</c> behaviour.
/// <para>
/// Registered <em>scoped</em>: it shares the per-request
/// <see cref="TicketsDbContext"/>.
/// </para>
/// </summary>
internal sealed class PostgresRefreshHandleStore(TicketsDbContext context, IClock clock)
    : IRefreshHandleStore
{
    public async Task<string> IssueAsync(
        StaffId staffId, DateTimeOffset expireAt, CancellationToken cancellationToken = default)
    {
        var handle = NewHandle();
        context.RefreshHandles.Add(new RefreshHandleEntry
        {
            Handle = handle,
            StaffId = staffId,
            ExpireAt = expireAt,
            CreatedAt = clock.UtcNow,
        });

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return handle;
    }

    public async Task<RefreshHandleRecord?> FindAsync(
        string handle, DateTimeOffset asOf, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(handle);

        // Treat an expired handle as not-found.
        var record = await context.RefreshHandles
            .AsNoTracking()
            .Where(h => h.Handle == handle && h.ExpireAt > asOf)
            .Select(h => new RefreshHandleRecord(h.StaffId, h.ExpireAt))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return record;
    }

    public async Task DeleteAsync(string handle, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(handle))
        {
            return;
        }

        await context.RefreshHandles
            .Where(h => h.Handle == handle)
            .ExecuteDeleteAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<string?> RotateAsync(
        string oldHandle,
        DateTimeOffset asOf,
        DateTimeOffset newExpireAt,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(oldHandle);

        // Atomic delete-old-then-insert-new. The single guarded ExecuteDelete
        // both validates (handle exists AND not expired) and retires the old
        // handle; if it removes exactly one row we won the rotation race and
        // know the staff to re-issue for. Wrapped in a transaction so the
        // delete + insert commit together.
        var staffId = await context.RefreshHandles
            .AsNoTracking()
            .Where(h => h.Handle == oldHandle && h.ExpireAt > asOf)
            .Select(h => (StaffId?)h.StaffId)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (staffId is null)
        {
            return null;
        }

        await using var transaction = await context.Database
            .BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);

        var deleted = await context.RefreshHandles
            .Where(h => h.Handle == oldHandle && h.ExpireAt > asOf)
            .ExecuteDeleteAsync(cancellationToken)
            .ConfigureAwait(false);

        if (deleted != 1)
        {
            // Lost the race — another rotation/delete already retired it.
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            return null;
        }

        var newHandle = NewHandle();
        context.RefreshHandles.Add(new RefreshHandleEntry
        {
            Handle = newHandle,
            StaffId = staffId.Value,
            ExpireAt = newExpireAt,
            CreatedAt = clock.UtcNow,
        });

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

        return newHandle;
    }

    private static string NewHandle()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
