namespace Tickets.Domain.Cases;

/// <summary>
/// Strongly-typed identifier for the <c>Case</c> aggregate.
/// <para>
/// Defined ahead of the full Case aggregate because <c>KioskDevice</c> references
/// it by ID only (DDD: cross-aggregate references go via Id, never via instance).
/// </para>
/// </summary>
public readonly record struct CaseId(Guid Value)
{
    public static CaseId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
