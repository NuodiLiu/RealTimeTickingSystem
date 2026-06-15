using Tickets.Domain.Cases;
using Tickets.Domain.Cases.Events;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Cases;

public sealed class CaseEscalationTests
{
    [Fact]
    public void Escalate_FromInProgress_RecordsMetadataButDoesNotChangeStatus()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AnInProgressCase(out _, clock);
        theCase.ClearDomainEvents();
        clock.Advance(TimeSpan.FromMinutes(2));

        theCase.Escalate("Finance", resolvedOnSite: false, clock);

        theCase.Status.Should().Be(CaseStatus.InProgress); // unchanged
        theCase.EscalatedTo.Should().Be("Finance");
        theCase.ResolvedOnSite.Should().Be(false);
        theCase.EscalatedAt.Should().Be(clock.UtcNow);
        var evt = theCase.DomainEvents.OfType<CaseEscalated>().Single();
        evt.Department.Should().Be("Finance");
        evt.ResolvedOnSite.Should().Be(false);
    }

    [Fact]
    public void Escalate_FromPendingFeedback_AlsoAllowed()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.APendingFeedbackCase(out _, out _, out _, out _, clock);
        theCase.ClearDomainEvents();

        theCase.Escalate("Finance", resolvedOnSite: true, clock);

        theCase.Status.Should().Be(CaseStatus.PendingFeedback); // unchanged
        theCase.EscalatedTo.Should().Be("Finance");
        theCase.ResolvedOnSite.Should().Be(true);
    }

    [Theory]
    [InlineData(CaseStatus.Queued)]
    [InlineData(CaseStatus.Resolved)]
    public void Escalate_FromQueuedOrResolved_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);
        var act = () => theCase.Escalate("Finance", resolvedOnSite: null, clock);
        act.Should().Throw<InvalidStateTransitionError>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Escalate_BlankDepartment_Throws(string department)
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AnInProgressCase(out _, clock);
        var act = () => theCase.Escalate(department, resolvedOnSite: null, clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Escalate_Twice_OverwritesMetadataAndRaisesNewEvent()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AnInProgressCase(out _, clock);
        theCase.Escalate("Finance", resolvedOnSite: false, clock);
        theCase.ClearDomainEvents();
        clock.Advance(TimeSpan.FromMinutes(1));

        theCase.Escalate("Library", resolvedOnSite: true, clock);

        theCase.EscalatedTo.Should().Be("Library");
        theCase.ResolvedOnSite.Should().Be(true);
        theCase.EscalatedAt.Should().Be(clock.UtcNow);
        theCase.DomainEvents.OfType<CaseEscalated>().Should().ContainSingle();
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
