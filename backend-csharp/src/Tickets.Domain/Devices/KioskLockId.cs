namespace Tickets.Domain.Devices;

/// <summary>Strongly-typed identifier for a <see cref="KioskLock"/> entity.</summary>
public readonly record struct KioskLockId(Guid Value)
{
    public static KioskLockId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
