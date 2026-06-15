using Tickets.Domain.Cases;
using Tickets.Domain.Staff;

namespace Tickets.Domain.Devices;

/// <summary>
/// Internal entity owned by <see cref="KioskDevice"/>. Represents the single
/// active lock on a device. Past locks (completed / overridden / expired) are
/// captured via domain events; this object only exists while a lock is Active.
/// <para>
/// External callers identify a lock by (<see cref="Id"/>, <see cref="Version"/>)
/// — both must match for any state-changing operation (CAS) to succeed. This
/// replaces the Node optimistic-lock pattern based on <c>updateMany WHERE ...</c>.
/// </para>
/// </summary>
public sealed class KioskLock
{
    public KioskLockId Id { get; }
    public StaffId StaffId { get; }
    public CaseId CaseId { get; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset LeaseExpireAt { get; }
    public uint Version { get; }

    // KioskLock is never mutated in place — operations like Complete / Override
    // create a *new* lock or remove the current one. Version exists so callers
    // can include it in their request payloads as a CAS token.
    internal KioskLock(
        KioskLockId id,
        StaffId staffId,
        CaseId caseId,
        DateTimeOffset createdAt,
        DateTimeOffset leaseExpireAt,
        uint version)
    {
        Id = id;
        StaffId = staffId;
        CaseId = caseId;
        CreatedAt = createdAt;
        LeaseExpireAt = leaseExpireAt;
        Version = version;
    }
}
