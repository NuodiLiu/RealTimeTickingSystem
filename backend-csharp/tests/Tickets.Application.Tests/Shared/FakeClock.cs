using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Tests.Shared;

internal sealed class FakeClock(DateTimeOffset start) : IClock
{
    public DateTimeOffset UtcNow { get; private set; } = start;

    public FakeClock() : this(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero)) { }

    public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
}
