using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Identity;

namespace Tickets.Infrastructure.Tests.Persistence;

/// <summary>
/// Integration tests for <see cref="PostgresRefreshHandleStore"/> against a real
/// Postgres container. Need Docker → run in CI; compile locally without it.
/// </summary>
[Collection("postgres")]
public sealed class PostgresRefreshHandleStoreTests(PostgresFixture fixture) : IAsyncLifetime
{
    private static readonly DateTimeOffset Now =
        new(2026, 6, 15, 12, 0, 0, TimeSpan.Zero);

    public Task InitializeAsync() => fixture.ResetAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private PostgresRefreshHandleStore CreateStore(DateTimeOffset? clockAt = null) =>
        new(fixture.CreateContext(), new FixedClock(clockAt ?? Now));

    [Fact]
    public async Task Issue_ThenFind_ReturnsStaffAndExpiry()
    {
        var staffId = StaffId.New();
        var expireAt = Now.AddDays(30);
        var handle = await CreateStore().IssueAsync(staffId, expireAt);

        var record = await CreateStore().FindAsync(handle, Now);

        record.Should().NotBeNull();
        record!.StaffId.Should().Be(staffId);
        record.ExpireAt.Should().BeCloseTo(expireAt, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task Find_ExpiredHandle_ReturnsNull()
    {
        var handle = await CreateStore().IssueAsync(StaffId.New(), Now.AddDays(1));

        var record = await CreateStore().FindAsync(handle, Now.AddDays(2));

        record.Should().BeNull();
    }

    [Fact]
    public async Task Find_UnknownHandle_ReturnsNull()
    {
        var record = await CreateStore().FindAsync("never-issued", Now);

        record.Should().BeNull();
    }

    [Fact]
    public async Task Delete_RemovesHandle()
    {
        var handle = await CreateStore().IssueAsync(StaffId.New(), Now.AddDays(30));

        await CreateStore().DeleteAsync(handle);

        (await CreateStore().FindAsync(handle, Now)).Should().BeNull();
    }

    [Fact]
    public async Task Rotate_ValidHandle_RetiresOldAndIssuesNewForSameStaff()
    {
        var staffId = StaffId.New();
        var oldHandle = await CreateStore().IssueAsync(staffId, Now.AddDays(30));

        var newHandle = await CreateStore().RotateAsync(oldHandle, Now, Now.AddDays(30));

        newHandle.Should().NotBeNull();
        newHandle.Should().NotBe(oldHandle);

        // Old handle is gone; new handle resolves to the same staff.
        (await CreateStore().FindAsync(oldHandle, Now)).Should().BeNull();
        var rotated = await CreateStore().FindAsync(newHandle!, Now);
        rotated.Should().NotBeNull();
        rotated!.StaffId.Should().Be(staffId);
    }

    [Fact]
    public async Task Rotate_AlreadyRotatedHandle_ReturnsNull()
    {
        var staffId = StaffId.New();
        var oldHandle = await CreateStore().IssueAsync(staffId, Now.AddDays(30));
        await CreateStore().RotateAsync(oldHandle, Now, Now.AddDays(30));

        // Replaying the retired handle must fail.
        var replay = await CreateStore().RotateAsync(oldHandle, Now, Now.AddDays(30));

        replay.Should().BeNull();
    }

    [Fact]
    public async Task Rotate_ExpiredHandle_ReturnsNull()
    {
        var oldHandle = await CreateStore().IssueAsync(StaffId.New(), Now.AddDays(1));

        var rotated = await CreateStore().RotateAsync(oldHandle, Now.AddDays(2), Now.AddDays(32));

        rotated.Should().BeNull();
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }
}
