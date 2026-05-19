using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Feedback.Commands;
using Tickets.Application.Feedback.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Feedback;

public sealed class OverrideFeedbackHandlerTests
{
    private readonly ICaseRepository _cases = Substitute.For<ICaseRepository>();
    private readonly IKioskDeviceRepository _devices = Substitute.For<IKioskDeviceRepository>();
    private readonly IFeedbackSessionRepository _sessions = Substitute.For<IFeedbackSessionRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private OverrideFeedbackHandler Handler(StaffId? staff = null) => new(
        _cases, _devices, _sessions, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<OverrideFeedbackHandler>.Instance);

    /// <summary>
    /// Builds a busy device holding a lock for case A, a PendingFeedback case
    /// A with an active session, plus a fresh InProgress case B that the
    /// override will switch to.
    /// </summary>
    private (KioskDevice device, Case caseA, FeedbackSession sessionA, Case caseB) FullBundle()
    {
        var device = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-01"),
            SecretHash.FromRaw("hash"),
            DeviceMode.Feedback,
            _clock);
        var staff = StaffId.New();

        var caseA = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, device.Id, _clock);
        caseA.Take(staff, _clock);

        var lockA = device.AcquireLock(staff, caseA.Id, TimeSpan.FromMinutes(1), _clock);
        var sessionA = FeedbackSession.Create(
            caseA.Id, staff, device.Id,
            _clock.UtcNow + TimeSpan.FromMinutes(5),
            _clock);
        caseA.RequestFeedback(device.Id, lockA.Id, sessionA.Id, _clock);

        var caseB = Case.Queue(
            StudentName.Parse("Mei"), Category.Parse("Library"), null, device.Id, _clock);
        caseB.Take(staff, _clock);

        return (device, caseA, sessionA, caseB);
    }

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null).HandleAsync(
            new OverrideFeedbackCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1),
            CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_DeviceNotFound_Returns404()
    {
        _devices.FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>()).Returns((KioskDevice?)null);

        var result = await Handler(StaffId.New()).HandleAsync(
            new OverrideFeedbackCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1),
            CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_IdleDevice_ReturnsConflict()
    {
        var device = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-Idle"),
            SecretHash.FromRaw("hash"),
            DeviceMode.Feedback,
            _clock);
        var caseB = Case.Queue(
            StudentName.Parse("Mei"), Category.Parse("Tech"), null, device.Id, _clock);
        caseB.Take(StaffId.New(), _clock);

        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _cases.FindByIdAsync(caseB.Id, Arg.Any<CancellationToken>()).Returns(caseB);

        var result = await Handler(StaffId.New()).HandleAsync(
            new OverrideFeedbackCommand(device.Id.Value, caseB.Id.Value, Guid.NewGuid(), 1),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("idle");
    }

    [Fact]
    public async Task HandleAsync_WrongLockVersion_ReturnsPreconditionFailed()
    {
        var (device, _, _, caseB) = FullBundle();
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _cases.FindByIdAsync(caseB.Id, Arg.Any<CancellationToken>()).Returns(caseB);

        var realLockId = device.CurrentLock!.Id;
        var result = await Handler(StaffId.New()).HandleAsync(
            new OverrideFeedbackCommand(device.Id.Value, caseB.Id.Value, realLockId.Value, 99),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("precondition_failed");
    }

    [Fact]
    public async Task HandleAsync_HappyPath_OverridesEverything()
    {
        var (device, caseA, sessionA, caseB) = FullBundle();
        var oldLockId = device.CurrentLock!.Id;
        var oldLockVersion = device.CurrentLock.Version;

        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _cases.FindByIdAsync(caseB.Id, Arg.Any<CancellationToken>()).Returns(caseB);
        _cases.FindByIdAsync(caseA.Id, Arg.Any<CancellationToken>()).Returns(caseA);
        _sessions.FindActiveByCaseAsync(caseA.Id, Arg.Any<CancellationToken>()).Returns(sessionA);

        var result = await Handler(StaffId.New()).HandleAsync(
            new OverrideFeedbackCommand(device.Id.Value, caseB.Id.Value, oldLockId.Value, oldLockVersion),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        device.CurrentLock.Should().NotBeNull();
        device.CurrentLock!.Id.Should().NotBe(oldLockId);
        device.CurrentLock.CaseId.Should().Be(caseB.Id);
        sessionA.Status.Should().Be(FeedbackSessionStatus.Overridden);
        caseA.Status.Should().Be(CaseStatus.Resolved);
        caseB.Status.Should().Be(CaseStatus.PendingFeedback);
        await _sessions.Received(1).AddAsync(Arg.Any<FeedbackSession>(), Arg.Any<CancellationToken>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_HappyPath_PushesDismissThenShowFeedbackThenDashboardUpdate()
    {
        var (device, caseA, sessionA, caseB) = FullBundle();
        var oldLockId = device.CurrentLock!.Id;
        var oldLockVersion = device.CurrentLock.Version;

        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _cases.FindByIdAsync(caseB.Id, Arg.Any<CancellationToken>()).Returns(caseB);
        _cases.FindByIdAsync(caseA.Id, Arg.Any<CancellationToken>()).Returns(caseA);
        _sessions.FindActiveByCaseAsync(caseA.Id, Arg.Any<CancellationToken>()).Returns(sessionA);

        await Handler(StaffId.New()).HandleAsync(
            new OverrideFeedbackCommand(device.Id.Value, caseB.Id.Value, oldLockId.Value, oldLockVersion),
            CancellationToken.None);

        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "dismissDevice", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "showFeedback", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).NotifyDashboardAsync(
            "device:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }
}
