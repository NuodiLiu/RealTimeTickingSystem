using Tickets.Domain.Cases;
using Tickets.Domain.Cases.Events;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Cases;

public sealed class CaseQueueAndTakeTests
{
    [Fact]
    public void Queue_NewCase_StartsAsQueued()
    {
        var clock = new FakeClock();
        var deviceId = DeviceId.New();

        var theCase = Case.Queue(
            CaseTestData.AName(),
            CaseTestData.ACategory(),
            CaseTestData.AZId(),
            createdByDeviceId: deviceId,
            clock);

        theCase.Status.Should().Be(CaseStatus.Queued);
        theCase.AssignedStaffId.Should().BeNull();
        theCase.StartedAt.Should().BeNull();
        theCase.ResolvedAt.Should().BeNull();
        theCase.CreatedByDeviceId.Should().Be(deviceId);
        theCase.CreatedAt.Should().Be(clock.UtcNow);
        theCase.Version.Should().Be(1);
    }

    [Fact]
    public void Queue_NewCase_RaisesCaseQueuedEvent()
    {
        var theCase = CaseTestData.AQueuedCase();
        theCase.DomainEvents.OfType<CaseQueued>().Should().ContainSingle();
    }

    [Fact]
    public void Queue_WithoutZId_AllowsNull()
    {
        var theCase = Case.Queue(
            CaseTestData.AName(),
            CaseTestData.ACategory(),
            zId: null,
            createdByDeviceId: null,
            new FakeClock());

        theCase.ZId.Should().BeNull();
        theCase.CreatedByDeviceId.Should().BeNull();
    }

    [Fact]
    public void Take_OnQueuedCase_TransitionsToInProgress()
    {
        var clock = new FakeClock();
        var theCase = CaseTestData.AQueuedCase(clock);
        theCase.ClearDomainEvents();
        var staff = StaffId.New();

        theCase.Take(staff, clock);

        theCase.Status.Should().Be(CaseStatus.InProgress);
        theCase.AssignedStaffId.Should().Be(staff);
        theCase.StartedAt.Should().Be(clock.UtcNow);
        theCase.DomainEvents.OfType<CaseTaken>().Should().ContainSingle();
    }

    [Theory]
    [InlineData(CaseStatus.InProgress)]
    [InlineData(CaseStatus.PendingFeedback)]
    [InlineData(CaseStatus.Resolved)]
    public void Take_FromNonQueuedState_Throws(CaseStatus startingStatus)
    {
        var clock = new FakeClock();
        var theCase = CaseFromState(startingStatus, clock);
        theCase.ClearDomainEvents();

        var act = () => theCase.Take(StaffId.New(), clock);
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
