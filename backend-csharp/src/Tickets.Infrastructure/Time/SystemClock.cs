using Tickets.Domain.Shared.Time;

namespace Tickets.Infrastructure.Time;

/// <summary>
/// Production <see cref="IClock"/>. Delegates to <see cref="TimeProvider.System"/>
/// rather than reading <c>DateTimeOffset.UtcNow</c> directly, so the CI
/// guardrail (AGENTS.md §7 #4) stays simple and this implementation
/// remains substitutable in tests if anyone ever wants to inject a fake
/// <see cref="TimeProvider"/>.
/// </summary>
internal sealed class SystemClock(TimeProvider timeProvider) : IClock
{
    public SystemClock() : this(TimeProvider.System) { }

    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();
}
