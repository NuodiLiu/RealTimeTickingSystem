namespace Tickets.Domain.Shared.Time;

/// <summary>
/// Abstraction over the system clock so domain methods can be deterministically tested.
/// <para>
/// AGENTS.md §7 Non-negotiable #4: product code MUST NOT use
/// <see cref="System.DateTimeOffset.UtcNow"/> or <see cref="System.DateTime.UtcNow"/>.
/// </para>
/// </summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
