using Tickets.Domain.Shared.Time;

namespace Tickets.Domain.Tests.Shared;

/// <summary>
/// Test double for <see cref="IClock"/>. Time only moves when tests call
/// <see cref="Advance"/>; <see cref="UtcNow"/> never advances on its own.
/// Forbidden in product code (see AGENTS.md §7 #4).
/// </summary>
public sealed class FakeClock(DateTimeOffset start) : IClock
{
    public DateTimeOffset UtcNow { get; private set; } = start;

    public FakeClock() : this(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero)) { }

    public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);

    public void Set(DateTimeOffset to) => UtcNow = to;
}
