using Tickets.Domain.Shared.Events;
using Tickets.Domain.Shared.ValueObjects;

namespace Tickets.Domain.Staff.Events;

/// <summary>
/// Emitted when the display name or email changes on an existing Staff record.
/// Triggered by the Application layer on every successful Azure AD callback so
/// the local copy stays in sync with the IdP (mirrors backend Staff service
/// <c>updateStaffProfile</c>).
/// </summary>
public sealed record StaffProfileUpdated(
    StaffId StaffId,
    string? NewName,
    EmailAddress? NewEmail,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
