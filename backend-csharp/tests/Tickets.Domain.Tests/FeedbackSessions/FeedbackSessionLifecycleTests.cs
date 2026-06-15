using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.FeedbackSessions.Events;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.FeedbackSessions;

public sealed class FeedbackSessionLifecycleTests
{
    [Fact]
    public void Create_StartsInCreatedStatus()
    {
        var clock = new FakeClock();
        var caseId = CaseId.New();
        var staffId = StaffId.New();
        var deviceId = DeviceId.New();
        var expireAt = clock.UtcNow + TimeSpan.FromMinutes(5);

        var session = FeedbackSession.Create(caseId, staffId, deviceId, expireAt, clock);

        session.Status.Should().Be(FeedbackSessionStatus.Created);
        session.CaseId.Should().Be(caseId);
        session.StaffId.Should().Be(staffId);
        session.DeviceId.Should().Be(deviceId);
        session.CreatedAt.Should().Be(clock.UtcNow);
        session.ExpireAt.Should().Be(expireAt);
        session.DeliveredAt.Should().BeNull();
        session.SubmittedAt.Should().BeNull();
        session.Rating.Should().BeNull();
        session.Comment.Should().BeNull();
        session.Version.Should().Be(1);
        session.DomainEvents.OfType<FeedbackSessionCreated>().Should().ContainSingle();
    }

    [Fact]
    public void Create_ExpireAtNotInFuture_Throws()
    {
        var clock = new FakeClock();
        var act = () => FeedbackSession.Create(
            CaseId.New(), StaffId.New(), DeviceId.New(),
            expireAt: clock.UtcNow, clock);   // not strictly future

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void MarkDelivered_FromCreated_TransitionsToDelivered()
    {
        var clock = new FakeClock();
        var session = FeedbackSessionTestData.ACreatedSession(clock);
        session.ClearDomainEvents();
        clock.Advance(TimeSpan.FromSeconds(2));

        session.MarkDelivered(clock);

        session.Status.Should().Be(FeedbackSessionStatus.Delivered);
        session.DeliveredAt.Should().Be(clock.UtcNow);
        session.DomainEvents.OfType<FeedbackSessionDelivered>().Should().ContainSingle();
    }

    [Theory]
    [InlineData(FeedbackSessionStatus.Delivered)]
    [InlineData(FeedbackSessionStatus.Submitted)]
    [InlineData(FeedbackSessionStatus.Cancelled)]
    [InlineData(FeedbackSessionStatus.Overridden)]
    [InlineData(FeedbackSessionStatus.Expired)]
    public void MarkDelivered_FromNonCreated_Throws(FeedbackSessionStatus startingStatus)
    {
        var session = SessionInStatus(startingStatus);
        var act = () => session.MarkDelivered(new FakeClock());
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
