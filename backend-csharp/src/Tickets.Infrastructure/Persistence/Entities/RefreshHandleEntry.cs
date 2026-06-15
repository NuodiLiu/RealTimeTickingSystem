using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Persistence.Entities;

/// <summary>
/// Persistence-only entity backing the <c>refresh_handles</c> table — the
/// server-side ledger of opaque one-time refresh handles. This is an
/// infrastructure concern, not a domain aggregate; the Application layer talks
/// to it exclusively through
/// <see cref="Tickets.Application.Auth.Abstractions.IRefreshHandleStore"/>.
/// </summary>
internal sealed class RefreshHandleEntry
{
    /// <summary>The opaque random handle (primary key).</summary>
    public required string Handle { get; init; }

    /// <summary>The staff member this handle authenticates.</summary>
    public required StaffId StaffId { get; init; }

    /// <summary>When the handle stops being redeemable.</summary>
    public required DateTimeOffset ExpireAt { get; init; }

    /// <summary>When the handle was issued.</summary>
    public required DateTimeOffset CreatedAt { get; init; }
}
