using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;

namespace Tickets.Infrastructure.Tests.Persistence;

[Collection("postgres")]
public sealed class CaseRepositoryTests(PostgresFixture fixture) : IAsyncLifetime
{
    public Task InitializeAsync() => fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private static Case AQueuedCase(IClock clock, string? zId = "z1234567") => Case.Queue(
        StudentName.Parse("Liam"),
        Category.Parse("Technical"),
        zId is null ? null : ZId.Parse(zId),
        createdByDeviceId: DeviceId.New(),
        clock);

    [Fact]
    public async Task Add_ThenFindById_RoundTripsAllFields()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var theCase = AQueuedCase(clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new CaseRepository(ctx).AddAsync(theCase);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new CaseRepository(verifyCtx).FindByIdAsync(theCase.Id);

        loaded.Should().NotBeNull();
        loaded!.Id.Should().Be(theCase.Id);
        loaded.StudentName.Should().Be(theCase.StudentName);
        loaded.Category.Should().Be(theCase.Category);
        loaded.ZId.Should().Be(theCase.ZId);
        loaded.Status.Should().Be(CaseStatus.Queued);
        loaded.CreatedAt.Should().BeCloseTo(theCase.CreatedAt, TimeSpan.FromMilliseconds(1));
        loaded.Version.Should().Be(theCase.Version);
    }

    [Fact]
    public async Task Add_NullZId_PersistsAsNull()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var theCase = AQueuedCase(clock, zId: null);

        await using (var ctx = fixture.CreateContext())
        {
            await new CaseRepository(ctx).AddAsync(theCase);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new CaseRepository(verifyCtx).FindByIdAsync(theCase.Id);
        loaded!.ZId.Should().BeNull();
    }

    [Fact]
    public async Task FindOldestQueued_ReturnsEarliestCreatedAt()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 0, 0, 0, TimeSpan.Zero));
        var older = AQueuedCase(clock);
        clock.Advance(TimeSpan.FromMinutes(1));
        var newer = AQueuedCase(clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new CaseRepository(ctx).AddAsync(older);
            await new CaseRepository(ctx).AddAsync(newer);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var picked = await new CaseRepository(verifyCtx).FindOldestQueuedAsync();
        picked!.Id.Should().Be(older.Id);
    }

    [Fact]
    public async Task ListByStatus_HonoursPaging()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 19, 0, 0, 0, TimeSpan.Zero));
        var cases = new List<Case>();
        for (var i = 0; i < 5; i++)
        {
            cases.Add(AQueuedCase(clock));
            clock.Advance(TimeSpan.FromSeconds(1));
        }

        await using (var ctx = fixture.CreateContext())
        {
            foreach (var c in cases)
            {
                await new CaseRepository(ctx).AddAsync(c);
            }
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var page2 = await new CaseRepository(verifyCtx)
            .ListByStatusAsync(CaseStatus.Queued, skip: 2, take: 2);

        page2.Should().HaveCount(2);
        page2.Select(c => c.Id).Should().Equal(cases[2].Id, cases[3].Id);
    }

    [Fact]
    public async Task Take_PersistsTransition()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 20, 0, 0, 0, TimeSpan.Zero));
        var theCase = AQueuedCase(clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new CaseRepository(ctx).AddAsync(theCase);
            await new UnitOfWork(ctx).CommitAsync();
        }

        var staffId = StaffId.New();
        await using (var ctx = fixture.CreateContext())
        {
            var loaded = await new CaseRepository(ctx).FindByIdAsync(theCase.Id);
            loaded!.Take(staffId, clock);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var taken = await new CaseRepository(verifyCtx).FindByIdAsync(theCase.Id);
        taken!.Status.Should().Be(CaseStatus.InProgress);
        taken.AssignedStaffId.Should().Be(staffId);
        taken.StartedAt.Should().NotBeNull();
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; private set; } = at;
        public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
    }
}
