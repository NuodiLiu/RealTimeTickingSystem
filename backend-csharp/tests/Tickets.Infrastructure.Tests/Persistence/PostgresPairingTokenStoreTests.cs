using Tickets.Domain.Shared.Time;
using Tickets.Infrastructure.Pairing;

namespace Tickets.Infrastructure.Tests.Persistence;

/// <summary>
/// Integration tests for <see cref="PostgresPairingTokenStore"/> against a real
/// Postgres container. Like the repository tests, these need Docker and so run
/// in CI; they compile locally without it.
/// </summary>
[Collection("postgres")]
public sealed class PostgresPairingTokenStoreTests(PostgresFixture fixture) : IAsyncLifetime
{
    private static readonly DateTimeOffset Now =
        new(2026, 6, 15, 12, 0, 0, TimeSpan.Zero);

    public Task InitializeAsync() => fixture.ResetAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private PostgresPairingTokenStore CreateStore(DateTimeOffset? clockAt = null) =>
        new(fixture.CreateContext(), new FixedClock(clockAt ?? Now));

    [Fact]
    public async Task Consume_PendingUnexpiredToken_ReturnsTrue()
    {
        const string token = "tok-pending";
        var store = CreateStore();
        await store.SaveAsync(token, Now.AddMinutes(10));

        var consumed = await CreateStore().ConsumeAsync(token, Now);

        consumed.Should().BeTrue();
    }

    [Fact]
    public async Task Consume_Twice_SecondReturnsFalse()
    {
        const string token = "tok-once";
        await CreateStore().SaveAsync(token, Now.AddMinutes(10));

        var first = await CreateStore().ConsumeAsync(token, Now);
        var second = await CreateStore().ConsumeAsync(token, Now);

        first.Should().BeTrue();
        second.Should().BeFalse();
    }

    [Fact]
    public async Task Consume_ExpiredToken_ReturnsFalse()
    {
        const string token = "tok-expired";
        await CreateStore().SaveAsync(token, Now.AddMinutes(5));

        // Consume "now" is past the token's expiry.
        var consumed = await CreateStore().ConsumeAsync(token, Now.AddMinutes(10));

        consumed.Should().BeFalse();
    }

    [Fact]
    public async Task Consume_UnknownToken_ReturnsFalse()
    {
        var consumed = await CreateStore().ConsumeAsync("never-saved", Now);

        consumed.Should().BeFalse();
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }
}
