namespace Tickets.Domain.Tests;

// Phase 0: verifies the test pipeline before any business code lands.
// AGENTS.md §6 Phase 0 — "在 Tickets.Domain.Tests 写 1 个空 Fact 验证 pipeline".
public sealed class SmokeTests
{
    [Fact]
    public void Pipeline_IsAlive()
    {
        true.Should().BeTrue();
    }
}
