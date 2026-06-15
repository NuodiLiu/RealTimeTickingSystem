using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Cases;

public sealed class ResolveCaseHandlerTests
{
    private readonly ICaseRepository _cases = Substitute.For<ICaseRepository>();
    private readonly IFeedbackSessionRepository _sessions = Substitute.For<IFeedbackSessionRepository>();
    private readonly IKioskDeviceRepository _devices = Substitute.For<IKioskDeviceRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private ResolveCaseHandler Handler(StaffId? staff = null) => new(
        _cases, _sessions, _devices, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<ResolveCaseHandler>.Instance);

    private Case AnInProgressCase()
    {
        var c = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);
        c.Take(StaffId.New(), _clock);
        return c;
    }

    private (Case, FeedbackSession, KioskDevice) APendingFeedbackBundle()
    {
        // Build the case and device states so their references align.
        var device = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-01"),
            SecretHash.FromRaw("hash"),
            DeviceMode.Feedback,
            _clock);
        var staff = StaffId.New();
        var theCase = AnInProgressCase();
        var lk = device.AcquireLock(staff, theCase.Id, TimeSpan.FromMinutes(1), _clock);
        var sessionId = FeedbackSessionId.New();
        theCase.RequestFeedback(device.Id, lk.Id, sessionId, _clock);

        var session = FeedbackSession.Create(
            theCase.Id, staff, device.Id,
            expireAt: _clock.UtcNow + TimeSpan.FromMinutes(5),
            _clock);

        return (theCase, session, device);
    }

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new ResolveCaseCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_CaseNotFound_Returns404()
    {
        _cases.FindByIdAsync(Arg.Any<CaseId>(), Arg.Any<CancellationToken>()).Returns((Case?)null);

        var result = await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_FromInProgress_ResolvesDirectlyAndCommits()
    {
        var theCase = AnInProgressCase();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        var result = await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(theCase.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        theCase.Status.Should().Be(CaseStatus.Resolved);
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await _sessions.DidNotReceive().FindActiveByCaseAsync(
            Arg.Any<CaseId>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FromInProgress_BroadcastsCaseUpdatedButNoDeviceUpdated()
    {
        var theCase = AnInProgressCase();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(theCase.Id.Value), CancellationToken.None);

        await _notify.Received(1).NotifyDashboardAsync(
            "case:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.DidNotReceive().NotifyDashboardAsync(
            "device:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.DidNotReceive().PushToDeviceAsync(
            Arg.Any<DeviceId>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FromPendingFeedback_CancelsSessionAndCompletesLock()
    {
        var (theCase, session, device) = APendingFeedbackBundle();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _sessions.FindActiveByCaseAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(session);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(theCase.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        theCase.Status.Should().Be(CaseStatus.Resolved);
        session.Status.Should().Be(FeedbackSessionStatus.Cancelled);
        device.IsBusy.Should().BeFalse();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FromPendingFeedback_PushesAllNotifications()
    {
        var (theCase, session, device) = APendingFeedbackBundle();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _sessions.FindActiveByCaseAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(session);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(theCase.Id.Value), CancellationToken.None);

        await _notify.Received(1).NotifyDashboardAsync(
            "case:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).NotifyDashboardAsync(
            "device:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "dismissDevice", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// api-cases.md pitfall #5 — resolve on already-resolved case must error,
    /// not silently overwrite resolvedAt.
    /// </summary>
    [Fact]
    public async Task HandleAsync_FromResolved_ReturnsConflict()
    {
        var theCase = AnInProgressCase();
        theCase.ResolveDirectly(_clock);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        var result = await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(theCase.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        await _uow.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FromQueued_ReturnsConflict()
    {
        var queued = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);
        _cases.FindByIdAsync(queued.Id, Arg.Any<CancellationToken>()).Returns(queued);

        var result = await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(queued.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
    }

    /// <summary>
    /// Anomaly path: Case says PendingFeedback but no session exists. The handler
    /// logs and resolves the case anyway — the alternative (failing) would leave
    /// a stuck case forever.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PendingFeedback_NoActiveSession_StillResolves()
    {
        var theCase = AnInProgressCase();
        // Drive the case to PendingFeedback manually.
        theCase.RequestFeedback(DeviceId.New(), KioskLockId.New(), FeedbackSessionId.New(), _clock);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _sessions.FindActiveByCaseAsync(theCase.Id, Arg.Any<CancellationToken>())
            .Returns((FeedbackSession?)null);

        var result = await Handler(StaffId.New())
            .HandleAsync(new ResolveCaseCommand(theCase.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        theCase.Status.Should().Be(CaseStatus.Resolved);
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await _devices.DidNotReceive().FindByIdAsync(
            Arg.Any<DeviceId>(), Arg.Any<CancellationToken>());
    }
}
