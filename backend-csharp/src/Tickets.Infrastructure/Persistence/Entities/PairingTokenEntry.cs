namespace Tickets.Infrastructure.Persistence.Entities;

/// <summary>
/// Persistence-only entity backing the <c>pairing_tokens</c> table. This is an
/// infrastructure concern (a one-time-token ledger), not a domain aggregate, so
/// it lives in the Infrastructure layer rather than the Domain. The Application
/// layer talks to it exclusively through
/// <see cref="Tickets.Application.Pairing.Abstractions.IPairingTokenStore"/>.
/// </summary>
internal sealed class PairingTokenEntry
{
    /// <summary>The opaque random token printed on the QR (primary key).</summary>
    public required string Token { get; init; }

    /// <summary>When the token stops being redeemable.</summary>
    public required DateTimeOffset ExpireAt { get; init; }

    /// <summary>
    /// When the token was redeemed via
    /// <see cref="Tickets.Application.Pairing.Abstractions.IPairingTokenStore.ConsumeAsync"/>;
    /// <c>null</c> while the token is still pending. The atomic CAS update keys on
    /// this column being <c>null</c> so a token can be consumed at most once.
    /// </summary>
    public DateTimeOffset? ConsumedAt { get; set; }

    /// <summary>When the token was minted.</summary>
    public required DateTimeOffset CreatedAt { get; init; }
}
