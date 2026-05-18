using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Staff.Events;

/// <summary>
/// Emitted when a Staff record's IdentityKey changes (e.g. tenant move, IdP migration).
/// Mirrors the migration branch of <c>getOrCreateStaff</c> in the Node backend
/// (Staff matched by email, identityKey replaced).
/// </summary>
public sealed record StaffIdentityMigrated(
    StaffId StaffId,
    IdentityKey OldIdentityKey,
    IdentityKey NewIdentityKey,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
