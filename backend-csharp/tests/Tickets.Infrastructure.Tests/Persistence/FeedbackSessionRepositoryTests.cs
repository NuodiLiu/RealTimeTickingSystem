using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;

namespace Tickets.Infrastructure.Tests.Persistence;

[Collection("postgres")]
public sealed class FeedbackSessionRepositoryTests(PostgresFixture fixture) : IAsyncLifetime
{
    public Task InitializeAsync() => fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private static FeedbackSession ACreatedSession(IClock clock, CaseId? caseId = null) =>
        FeedbackSession.Create(
            caseId ?? CaseId.New(),
            StaffId.New(),
            DeviceId.New(),
            expireAt: clock.UtcNow + TimeSpan.FromMinutes(5),
            clock);

    [Fact]
    public async Task Add_ThenFindById_RoundTripsAllFields()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var session = ACreatedSession(clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new FeedbackSessionRepository(ctx).AddAsync(session);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new FeedbackSessionRepository(verifyCtx).FindByIdAsync(session.Id);

        loaded.Should().NotBeNull();
        loaded!.Id.Should().Be(session.Id);
        loaded.CaseId.Should().Be(session.CaseId);
        loaded.DeviceId.Should().Be(session.DeviceId);
        loaded.StaffId.Should().Be(session.StaffId);
        loaded.Status.Should().Be(FeedbackSessionStatus.Created);
        loaded.Rating.Should().BeNull();
        loaded.Comment.Should().BeNull();
    }

    [Fact]
    public async Task SubmitFlow_PersistsRatingAndCommentAsNonNullVOs()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var session = ACreatedSession(clock);
        session.MarkDelivered(clock);
        session.Submit(
            FeedbackRating.From(4),
            FeedbackComment.Parse("Helpful, thanks!"),
            clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new FeedbackSessionRepository(ctx).AddAsync(session);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new FeedbackSessionRepository(verifyCtx).FindByIdAsync(session.Id);

        loaded!.Status.Should().Be(FeedbackSessionStatus.Submitted);
        loaded.Rating.Should().NotBeNull();
        loaded.Rating!.Value.Value.Should().Be(4);
        loaded.Comment.Should().NotBeNull();
        loaded.Comment!.Value.Value.Should().Be("Helpful, thanks!");
    }

    [Fact]
    public async Task FindActiveByCase_OnlyReturnsCreatedOrDelivered()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var caseId = CaseId.New();

        var active = ACreatedSession(clock, caseId);
        var cancelled = ACreatedSession(clock, caseId);
        cancelled.Cancel(clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new FeedbackSessionRepository(ctx).AddAsync(active);
            await new FeedbackSessionRepository(ctx).AddAsync(cancelled);
            await new UnitOfWork(ctx).CommitAsync();
        }

        await using var verifyCtx = fixture.CreateContext();
        var found = await new FeedbackSessionRepository(verifyCtx).FindActiveByCaseAsync(caseId);
        found!.Id.Should().Be(active.Id);
    }

    [Fact]
    public async Task FindExpired_ReturnsOnlyOverdueActiveSessions()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        var overdue = ACreatedSession(clock);                 // expireAt = now + 5min
        var fresh = ACreatedSession(clock);                   // same expireAt
        var submitted = ACreatedSession(clock);
        submitted.MarkDelivered(clock);
        submitted.Submit(FeedbackRating.From(5), null, clock);

        await using (var ctx = fixture.CreateContext())
        {
            await new FeedbackSessionRepository(ctx).AddAsync(overdue);
            await new FeedbackSessionRepository(ctx).AddAsync(fresh);
            await new FeedbackSessionRepository(ctx).AddAsync(submitted);
            await new UnitOfWork(ctx).CommitAsync();
        }

        // Sweep at "now + 10min" — both Created sessions are overdue; the
        // Submitted one is excluded because it is no longer active.
        var sweepAt = clock.UtcNow + TimeSpan.FromMinutes(10);
        await using var verifyCtx = fixture.CreateContext();
        var expired = await new FeedbackSessionRepository(verifyCtx)
            .FindExpiredAsync(sweepAt, maxResults: 10);

        expired.Select(s => s.Id).Should().BeEquivalentTo(new[] { overdue.Id, fresh.Id });
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }
}
