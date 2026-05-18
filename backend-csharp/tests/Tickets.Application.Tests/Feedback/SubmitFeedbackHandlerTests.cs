using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Feedback.Commands;
using Tickets.Application.Feedback.Handlers;
using Tickets.Application.Feedback.Validators;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Feedback;

public sealed class SubmitFeedbackHandlerTests
{
    private readonly IFeedbackSessionRepository _sessions = Substitute.For<IFeedbackSessionRepository>();
    private readonly ICaseRepository _cases = Substitute.For<ICaseRepository>();
    private readonly IKioskDeviceRepository _devices = Substitute.For<IKioskDeviceRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private SubmitFeedbackHandler Handler(DeviceId? caller = null) => new(
        _sessions, _cases, _devices, _uow, _clock, _notify,
        caller is null ? FakeCurrentDevice.AnonymousDevice() : FakeCurrentDevice.Identified(caller),
        new SubmitFeedbackCommandValidator(),
        NullLogger<SubmitFeedbackHandler>.Instance);

    /// <summary>
    /// Builds a fully wired bundle: an InProgress case with a request-feedback
    /// transition, a paired+busy device holding a lock for that case, and a
    /// Created/Delivered session for that case+device.
    /// </summary>
    private (FeedbackSession session, Case theCase, KioskDevice device) BuildBundle(
        FeedbackSessionStatus startStatus = FeedbackSessionStatus.Delivered)
    {
        var staff = StaffId.New();
        var device = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-01"),
            SecretHash.FromRaw("hash"),
            DeviceMode.Feedback,
            _clock);

        var theCase = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, device.Id, _clock);
        theCase.Take(staff, _clock);

        var lk = device.AcquireLock(staff, theCase.Id, TimeSpan.FromMinutes(1), _clock);

        var session = FeedbackSession.Create(
            theCase.Id, staff, device.Id,
            expireAt: _clock.UtcNow + TimeSpan.FromMinutes(5),
            _clock);

        theCase.RequestFeedback(device.Id, lk.Id, session.Id, _clock);

        if (startStatus == FeedbackSessionStatus.Delivered)
        {
            session.MarkDelivered(_clock);
        }

        return (session, theCase, device);
    }

    [Fact]
    public async Task HandleAsync_AnonymousDevice_Unauthorized()
    {
        var result = await Handler(caller: null).HandleAsync(
            new SubmitFeedbackCommand(Guid.NewGuid(), 5, null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public async Task HandleAsync_RatingOutOfRange_ReturnsValidationError(int rating)
    {
        var result = await Handler(DeviceId.New()).HandleAsync(
            new SubmitFeedbackCommand(Guid.NewGuid(), rating, null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }

    [Fact]
    public async Task HandleAsync_SessionNotFound_Returns404()
    {
        _sessions.FindByIdAsync(Arg.Any<FeedbackSessionId>(), Arg.Any<CancellationToken>())
            .Returns((FeedbackSession?)null);

        var result = await Handler(DeviceId.New()).HandleAsync(
            new SubmitFeedbackCommand(Guid.NewGuid(), 5, null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    /// <summary>api-feedback.md pitfall #16: ownership must be enforced.</summary>
    [Fact]
    public async Task HandleAsync_DeviceMismatch_Returns403()
    {
        var (session, _, _) = BuildBundle();
        _sessions.FindByIdAsync(session.Id, Arg.Any<CancellationToken>()).Returns(session);

        var someoneElse = DeviceId.New();
        var result = await Handler(someoneElse).HandleAsync(
            new SubmitFeedbackCommand(session.Id.Value, 5, "Great!"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(403);
        result.Error.Code.Should().Be("session_device_mismatch");
    }

    [Fact]
    public async Task HandleAsync_HappyPath_TransitionsAllAggregatesAndPushes()
    {
        var (session, theCase, device) = BuildBundle();
        _sessions.FindByIdAsync(session.Id, Arg.Any<CancellationToken>()).Returns(session);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(device.Id).HandleAsync(
            new SubmitFeedbackCommand(session.Id.Value, 4, "Helpful!"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        session.Status.Should().Be(FeedbackSessionStatus.Submitted);
        theCase.Status.Should().Be(CaseStatus.Resolved);
        device.IsBusy.Should().BeFalse();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "dismissDevice", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// AGENTS.md §4.2 — Submit requires Delivered. If the iPad ACK was lost,
    /// the handler synthesises MarkDelivered first so the customer's submit
    /// still goes through.
    /// </summary>
    [Fact]
    public async Task HandleAsync_SessionStillCreated_MarksDeliveredBeforeSubmit()
    {
        var (session, theCase, device) = BuildBundle(startStatus: FeedbackSessionStatus.Created);
        session.Status.Should().Be(FeedbackSessionStatus.Created);
        _sessions.FindByIdAsync(session.Id, Arg.Any<CancellationToken>()).Returns(session);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(device.Id).HandleAsync(
            new SubmitFeedbackCommand(session.Id.Value, 5, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        session.Status.Should().Be(FeedbackSessionStatus.Submitted);
        session.DeliveredAt.Should().NotBeNull();
    }

    /// <summary>
    /// api-feedback.md pitfall #7 — replay must be idempotent. Legacy
    /// swallowed P2002 and returned <c>feedback=null</c>; new system returns
    /// success with the existing snapshot.
    /// </summary>
    [Fact]
    public async Task HandleAsync_AlreadySubmitted_ReturnsSuccess_Idempotent()
    {
        var (session, _, _) = BuildBundle();
        session.Submit(FeedbackRating.From(5), null, _clock);
        _sessions.FindByIdAsync(session.Id, Arg.Any<CancellationToken>()).Returns(session);

        var result = await Handler(session.DeviceId).HandleAsync(
            new SubmitFeedbackCommand(session.Id.Value, 3, "different"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Rating.Should().Be(5);   // unchanged
        await _uow.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(FeedbackSessionStatus.Cancelled)]
    [InlineData(FeedbackSessionStatus.Overridden)]
    [InlineData(FeedbackSessionStatus.Expired)]
    public async Task HandleAsync_TerminalSession_ReturnsConflict(FeedbackSessionStatus terminal)
    {
        var (session, _, _) = BuildBundle();
        switch (terminal)
        {
            case FeedbackSessionStatus.Cancelled: session.Cancel(_clock); break;
            case FeedbackSessionStatus.Overridden: session.MarkOverridden(_clock); break;
            case FeedbackSessionStatus.Expired:
                _clock.Advance(TimeSpan.FromMinutes(10));
                session.Expire(_clock);
                break;
        }
        _sessions.FindByIdAsync(session.Id, Arg.Any<CancellationToken>()).Returns(session);

        var result = await Handler(session.DeviceId).HandleAsync(
            new SubmitFeedbackCommand(session.Id.Value, 5, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_NotificationFails_StillCommitsAndSucceeds()
    {
        var (session, theCase, device) = BuildBundle();
        _sessions.FindByIdAsync(session.Id, Arg.Any<CancellationToken>()).Returns(session);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _notify.NotifyDashboardAsync(Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));
        _notify.PushToDeviceAsync(Arg.Any<DeviceId>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));

        var result = await Handler(device.Id).HandleAsync(
            new SubmitFeedbackCommand(session.Id.Value, 5, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }
}
