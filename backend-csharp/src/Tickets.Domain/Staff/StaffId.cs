namespace Tickets.Domain.Staff;

/// <summary>Strongly-typed identifier for the <see cref="Staff"/> aggregate.</summary>
public readonly record struct StaffId(Guid Value)
{
    public static StaffId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
