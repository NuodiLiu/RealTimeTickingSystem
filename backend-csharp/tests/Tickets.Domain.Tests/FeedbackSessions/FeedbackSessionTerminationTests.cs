using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.FeedbackSessions.Errors;
using Tickets.Domain.FeedbackSessions.Events;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.FeedbackSessions;

public sealed class FeedbackSessionTerminationTests
{
    // ───── Cancel ────────────────────────────────────────────────────────

    [Theory]
    [InlineData(FeedbackSessionStatus.Created)]
    [InlineData(FeedbackSessionStatus.Delivered)]
    public void Cancel_FromActiveStatus_TransitionsToCancelled(FeedbackSessionStatus startingStatus)
    {
        var clock = new FakeClock();
        var session = startingStatus == FeedbackSessionStatus.Created
            ? FeedbackSessionTestData.ACreatedSession(clock)
            : FeedbackSessionTestData.ADeliveredSession(clock);
        session.ClearDomainEvents();

        session.Cancel(clock);

        session.Status.Should().Be(FeedbackSessionStatus.Cancelled);
        session.CancelledAt.Should().Be(clock.UtcNow);
        session.DomainEvents.OfType<FeedbackSessionCancelled>().Should().ContainSingle();
    }

    [Theory]
    [InlineData(FeedbackSessionStatus.Submitted)]
    [InlineData(FeedbackSessionStatus.Cancelled)]
    [InlineData(FeedbackSessionStatus.Overridden)]
    [InlineData(FeedbackSessionStatus.Expired)]
    public void Cancel_FromTerminal_Throws(FeedbackSessionStatus startingStatus)
    {
        var session = SessionInStatus(startingStatus);
        var act = () => session.Cancel(new FakeClock());
        act.Should().Throw<InvalidStateTransitionError>();
    }

    // ───── MarkOverridden ────────────────────────────────────────────────

    [Theory]
    [InlineData(FeedbackSessionStatus.Created)]
    [InlineData(FeedbackSessionStatus.Delivered)]
    public void MarkOverridden_FromActiveStatus_TransitionsToOverridden(FeedbackSessionStatus startingStatus)
    {
        var clock = new FakeClock();
        var session = startingStatus == FeedbackSessionStatus.Created
            ? FeedbackSessionTestData.ACreatedSession(clock)
            : FeedbackSessionTestData.ADeliveredSession(clock);
        session.ClearDomainEvents();

        session.MarkOverridden(clock);

        session.Status.Should().Be(FeedbackSessionStatus.Overridden);
        session.OverriddenAt.Should().Be(clock.UtcNow);
        session.DomainEvents.OfType<FeedbackSessionOverridden>().Should().ContainSingle();
    }

    [Theory]
    [InlineData(FeedbackSessionStatus.Submitted)]
    [InlineData(FeedbackSessionStatus.Cancelled)]
    [InlineData(FeedbackSessionStatus.Overridden)]
    [InlineData(FeedbackSessionStatus.Expired)]
    public void MarkOverridden_FromTerminal_Throws(FeedbackSessionStatus startingStatus)
    {
        var session = SessionInStatus(startingStatus);
        var act = () => session.MarkOverridden(new FakeClock());
        act.Should().Throw<InvalidStateTransitionError>();
    }

    // ───── Expire ────────────────────────────────────────────────────────

    [Theory]
    [InlineData(FeedbackSessionStatus.Created)]
    [InlineData(FeedbackSessionStatus.Delivered)]
    public void Expire_AfterDeadline_TransitionsToExpired(FeedbackSessionStatus startingStatus)
    {
        var clock = new FakeClock();
        var session = startingStatus == FeedbackSessionStatus.Created
            ? FeedbackSessionTestData.ACreatedSession(clock)
            : FeedbackSessionTestData.ADeliveredSession(clock);
        session.ClearDomainEvents();
        clock.Set(session.ExpireAt + TimeSpan.FromSeconds(1));

        session.Expire(clock);

        session.Status.Should().Be(FeedbackSessionStatus.Expired);
        session.ExpiredAt.Should().Be(clock.UtcNow);
        session.DomainEvents.OfType<FeedbackSessionExpired>().Should().ContainSingle();
    }

    [Fact]
    public void Expire_BeforeDeadline_Throws()
    {
        var clock = new FakeClock();
        var session = FeedbackSessionTestData.ACreatedSession(clock);
        clock.Set(session.ExpireAt - TimeSpan.FromSeconds(1));

        var act = () => session.Expire(clock);

        act.Should().Throw<FeedbackExpireNotDueError>();
        session.Status.Should().Be(FeedbackSessionStatus.Created); // unchanged
    }

    [Theory]
    [InlineData(FeedbackSessionStatus.Submitted)]
    [InlineData(FeedbackSessionStatus.Cancelled)]
    [InlineData(FeedbackSessionStatus.Overridden)]
    [InlineData(FeedbackSessionStatus.Expired)]
    public void Expire_FromTerminal_Throws(FeedbackSessionStatus startingStatus)
    {
        var session = SessionInStatus(startingStatus);
        var clock = new FakeClock(session.ExpireAt + TimeSpan.FromMinutes(1));

        var act = () => session.Expire(clock);
        act.Should().Throw<InvalidStateTransitionError>();
    }

    private static FeedbackSession SessionInStatus(FeedbackSessionStatus status) => status switch
    {
        FeedbackSessionStatus.Created => FeedbackSessionTestData.ACreatedSession(),
        FeedbackSessionStatus.Delivered => FeedbackSessionTestData.ADeliveredSession(),
        FeedbackSessionStatus.Submitted => FeedbackSessionTestData.ASubmittedSession(),
        FeedbackSessionStatus.Cancelled => FeedbackSessionTestData.ACancelledSession(),
        FeedbackSessionStatus.Overridden => FeedbackSessionTestData.AnOverriddenSession(),
        FeedbackSessionStatus.Expired => FeedbackSessionTestData.AnExpiredSession(),
        _ => throw new ArgumentOutOfRangeException(nameof(status)),
    };
}
