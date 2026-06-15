namespace Tickets.Domain.Devices;

/// <summary>Strongly-typed identifier for the <see cref="KioskDevice"/> aggregate.</summary>
public readonly record struct DeviceId(Guid Value)
{
    public static DeviceId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
