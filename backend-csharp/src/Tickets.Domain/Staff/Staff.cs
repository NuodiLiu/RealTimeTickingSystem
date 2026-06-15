using Tickets.Domain.Shared.Aggregates;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff.Events;

namespace Tickets.Domain.Staff;

/// <summary>
/// Aggregate root representing a member of staff authenticated via Azure AD SSO.
/// <para>
/// Staff has no state machine; all behaviors are idempotent profile updates plus
/// role changes. The Application layer reuses <see cref="Provision"/> on first
/// login and <see cref="UpdateProfile"/> on every subsequent login to keep the
/// local copy in sync with the IdP (mirroring backend/src/services/staff.service.ts).
/// </para>
/// <para>
/// Mapped pitfalls:
/// <list type="bullet">
///   <item>api-auth.md #5 — new staff always start at <see cref="StaffRole.Staff"/>;
///         first admin must be promoted via <see cref="ChangeRole"/>.</item>
///   <item>api-auth.md #10 — no <c>password</c> field; Azure AD is the only IdP.</item>
/// </list>
/// </para>
/// </summary>
public sealed class Staff : AggregateRoot
{
    public StaffId Id { get; }
    public IdentityKey IdentityKey { get; private set; }
    public EmailAddress Email { get; private set; }
    public EmployeeNo EmployeeNo { get; }
    public StaffRole Role { get; private set; }
    public string? Name { get; private set; }
    public DateTimeOffset CreatedAt { get; }

    // EF-friendly private ctor; do not call from production code.
    private Staff(
        StaffId id,
        IdentityKey identityKey,
        EmailAddress email,
        EmployeeNo employeeNo,
        StaffRole role,
        string? name,
        DateTimeOffset createdAt)
    {
        Id = id;
        IdentityKey = identityKey;
        Email = email;
        EmployeeNo = employeeNo;
        Role = role;
        Name = name;
        CreatedAt = createdAt;
    }

    /// <summary>
    /// Creates a fresh Staff record from validated Azure-AD claims.
    /// Role defaults to <see cref="StaffRole.Staff"/>.
    /// </summary>
    public static Staff Provision(
        IdentityKey identityKey,
        EmailAddress email,
        EmployeeNo employeeNo,
        string? displayName,
        IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        var staff = new Staff(
            id: StaffId.New(),
            identityKey: identityKey,
            email: email,
            employeeNo: employeeNo,
            role: StaffRole.Staff,
            name: displayName,
            createdAt: clock.UtcNow);

        staff.BumpVersion();
        staff.RaiseEvent(new StaffCreated(
            staff.Id, staff.IdentityKey, staff.Email, staff.EmployeeNo, staff.Role, clock.UtcNow));

        return staff;
    }

    /// <summary>
    /// Updates display name and/or email. Idempotent — no event raised if nothing changed.
    /// </summary>
    public void UpdateProfile(string? name, EmailAddress email, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        var nameChanged = !string.Equals(name, Name, StringComparison.Ordinal);
        var emailChanged = email != Email;

        if (!nameChanged && !emailChanged)
        {
            return;
        }

        if (nameChanged)
        {
            Name = name;
        }

        if (emailChanged)
        {
            Email = email;
        }

        BumpVersion();
        RaiseEvent(new StaffProfileUpdated(
            Id,
            NewName: nameChanged ? name : null,
            NewEmail: emailChanged ? email : null,
            OccurredAt: clock.UtcNow));
    }

    /// <summary>
    /// Replaces the identity key (Azure AD identity migration / tenant move).
    /// Idempotent — no event if the key is unchanged.
    /// </summary>
    public void MigrateIdentity(IdentityKey newIdentityKey, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        if (newIdentityKey == IdentityKey)
        {
            return;
        }

        var oldKey = IdentityKey;
        IdentityKey = newIdentityKey;
        BumpVersion();
        RaiseEvent(new StaffIdentityMigrated(Id, oldKey, newIdentityKey, clock.UtcNow));
    }

    /// <summary>
    /// Promotes or demotes the role. Idempotent — no event if the role is unchanged.
    /// </summary>
    public void ChangeRole(StaffRole newRole, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        if (newRole == Role)
        {
            return;
        }

        var from = Role;
        Role = newRole;
        BumpVersion();
        RaiseEvent(new StaffRoleChanged(Id, from, newRole, clock.UtcNow));
    }

    /// <summary>True when this staff's role is at least the required level.</summary>
    public bool HasAtLeast(StaffRole required) => (int)Role >= (int)required;
}
