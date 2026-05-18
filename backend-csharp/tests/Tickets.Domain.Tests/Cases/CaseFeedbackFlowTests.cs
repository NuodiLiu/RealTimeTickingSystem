using Tickets.Domain.Cases;
using Tickets.Domain.Cases.Events;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Cases;

public sealed class CaseFeedbackFlowTests
{
    [Fact]
    public void RequestFeedback_FromInProgress_TransitionsToPendingFeedback()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AnInProgressCase(out _, clock);
        theCase.ClearDomainEvents();

        var deviceId = DeviceId.New();
        var lockId = KioskLockId.New();
        var sessionId = FeedbackSessionId.New();
        theCase.RequestFeedback(deviceId, lockId, sessionId, clock);

        theCase.Status.Should().Be(CaseStatus.PendingFeedback);
        var evt = theCase.DomainEvents.OfType<CaseFeedbackRequested>().Single();
        evt.DeviceId.Should().Be(deviceId);
        evt.LockId.Should().Be(lockId);
        evt.SessionId.Should().Be(sessionId);
    }

    [Theory]
    [InlineData(CaseStatus.Queued)]
    [InlineData(CaseStatus.PendingFeedback)]
    [InlineData(CaseStatus.Resolved)]
    public void RequestFeedback_FromNonInProgress_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);

        var act = () => theCase.RequestFeedback(
            DeviceId.New(), KioskLockId.New(), FeedbackSessionId.New(), clock);

        act.Should().Throw<InvalidStateTransitionError>();
    }

    [Fact]
    public void AbandonFeedbackSession_FromPendingFeedback_RollsBackToInProgress()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.AbandonFeedbackSession(clock);

        theCase.Status.Should().Be(CaseStatus.InProgress);
        theCase.DomainEvents.OfType<CaseFeedbackAbandoned>().Should().ContainSingle();
    }

    [Theory]
    [InlineData(CaseStatus.Queued)]
    [InlineData(CaseStatus.InProgress)]
    [InlineData(CaseStatus.Resolved)]
    public void AbandonFeedbackSession_FromNonPending_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);

        var act = () => theCase.AbandonFeedbackSession(clock);
        act.Should().Throw<InvalidStateTransitionError>();
    }

    private static Case CaseFromState(CaseStatus target, IClock clock)
    {
        return target switch
        {
            CaseStatus.Queued => CaseTestData.AQueuedCase(clock),
            CaseStatus.InProgress => CaseTestData.AnInProgressCase(out _, clock),
            CaseStatus.PendingFeedback => CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock),
            CaseStatus.Resolved => CaseTestData.AResolvedCase(clock),
            _ => throw new ArgumentOutOfRangeException(nameof(target)),
        };
    }
}
