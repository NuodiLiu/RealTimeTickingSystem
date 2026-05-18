using Tickets.Domain.Cases;
using Tickets.Domain.Cases.Events;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Cases;

public sealed class CaseResolveTests
{
    [Fact]
    public void ResolveDirectly_FromInProgress_TransitionsToResolved()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AnInProgressCase(out _, clock);
        theCase.ClearDomainEvents();
        clock.Advance(TimeSpan.FromMinutes(5));

        theCase.ResolveDirectly(clock);

        theCase.Status.Should().Be(CaseStatus.Resolved);
        theCase.ResolvedAt.Should().Be(clock.UtcNow);
        var evt = theCase.DomainEvents.OfType<CaseResolved>().Single();
        evt.Reason.Should().Be(CaseResolutionReason.ResolvedDirectly);
    }

    [Theory]
    [InlineData(CaseStatus.Queued)]
    [InlineData(CaseStatus.PendingFeedback)]
    [InlineData(CaseStatus.Resolved)]
    public void ResolveDirectly_FromNonInProgress_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);

        var act = () => theCase.ResolveDirectly(clock);
        act.Should().Throw<InvalidStateTransitionError>();
    }

    /// <summary>
    /// Fix for api-cases.md known pitfall #5 — Node system silently overwrote
    /// <c>resolvedAt</c> when called on an already-Resolved case. The new
    /// system explicitly rejects.
    /// </summary>
    [Fact]
    public void ResolveDirectly_OnResolvedCase_DoesNotOverwriteResolvedAt()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AResolvedCase(clock);
        var originalResolvedAt = theCase.ResolvedAt;
        clock.Advance(TimeSpan.FromHours(1));

        var act = () => theCase.ResolveDirectly(clock);

        act.Should().Throw<InvalidStateTransitionError>();
        theCase.ResolvedAt.Should().Be(originalResolvedAt);
    }

    [Fact]
    public void SubmitFeedback_FromPendingFeedback_ResolvesWithCorrectReason()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.SubmitFeedback(clock);

        theCase.Status.Should().Be(CaseStatus.Resolved);
        theCase.DomainEvents.OfType<CaseResolved>().Single().Reason
            .Should().Be(CaseResolutionReason.FeedbackSubmitted);
    }

    [Fact]
    public void ForceResolve_FromPendingFeedback_ResolvesWithCorrectReason()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.ForceResolve(clock);

        theCase.Status.Should().Be(CaseStatus.Resolved);
        theCase.DomainEvents.OfType<CaseResolved>().Single().Reason
            .Should().Be(CaseResolutionReason.StaffForceResolved);
    }

    [Fact]
    public void FeedbackOverridden_FromPendingFeedback_ResolvesWithCorrectReason()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.FeedbackOverridden(clock);

        theCase.Status.Should().Be(CaseStatus.Resolved);
        theCase.DomainEvents.OfType<CaseResolved>().Single().Reason
            .Should().Be(CaseResolutionReason.FeedbackOverridden);
    }

    [Fact]
    public void FeedbackExpired_FromPendingFeedback_ResolvesWithCorrectReason()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.FeedbackExpired(clock);

        theCase.Status.Should().Be(CaseStatus.Resolved);
        theCase.DomainEvents.OfType<CaseResolved>().Single().Reason
            .Should().Be(CaseResolutionReason.FeedbackExpired);
    }

    [Fact]
    public void DeviceLost_FromPendingFeedback_ResolvesWithCorrectReason()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.DeviceLost(clock);

        theCase.Status.Should().Be(CaseStatus.Resolved);
        theCase.DomainEvents.OfType<CaseResolved>().Single().Reason
            .Should().Be(CaseResolutionReason.DeviceLost);
    }

    [Theory]
    [InlineData(CaseStatus.Queued)]
    [InlineData(CaseStatus.InProgress)]
    [InlineData(CaseStatus.Resolved)]
    public void SubmitFeedback_FromNonPending_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);
        var act = () => theCase.SubmitFeedback(clock);
        act.Should().Throw<InvalidStateTransitionError>();
    }

    [Theory]
    [InlineData(CaseStatus.Queued)]
    [InlineData(CaseStatus.InProgress)]
    [InlineData(CaseStatus.Resolved)]
    public void ForceResolve_FromNonPending_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);
        var act = () => theCase.ForceResolve(clock);
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
