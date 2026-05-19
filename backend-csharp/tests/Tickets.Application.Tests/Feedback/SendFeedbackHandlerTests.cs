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

public sealed class SendFeedbackHandlerTests
{
    private readonly ICaseRepository _cases = Substitute.For<ICaseRepository>();
    private readonly IKioskDeviceRepository _devices = Substitute.For<IKioskDeviceRepository>();
    private readonly IFeedbackSessionRepository _sessions = Substitute.For<IFeedbackSessionRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private SendFeedbackHandler Handler(StaffId? staff = null) => new(
        _cases, _devices, _sessions, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<SendFeedbackHandler>.Instance);

    private (Case theCase, KioskDevice device) Bundle()
    {
        var theCase = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);
        theCase.Take(StaffId.New(), _clock);
        var device = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-01"),
            SecretHash.FromRaw("hash"),
            DeviceMode.Feedback,
            _clock);
        return (theCase, device);
    }

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null).HandleAsync(
            new SendFeedbackCommand(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_CaseNotFound_Returns404()
    {
        _cases.FindByIdAsync(Arg.Any<CaseId>(), Arg.Any<CancellationToken>()).Returns((Case?)null);

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
        result.Error.Code.Should().Be("case_not_found");
    }

    [Fact]
    public async Task HandleAsync_DeviceNotFound_Returns404()
    {
        var (theCase, _) = Bundle();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>()).Returns((KioskDevice?)null);

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_RegistrationModeDevice_ReturnsInvalidMode()
    {
        var (theCase, _) = Bundle();
        var regDevice = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-Reg"),
            SecretHash.FromRaw("hash"),
            DeviceMode.Registration,
            _clock);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(regDevice.Id, Arg.Any<CancellationToken>()).Returns(regDevice);

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, regDevice.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(403);
        result.Error.Code.Should().Be("invalid_device_mode");
    }

    [Fact]
    public async Task HandleAsync_HappyPath_AcquiresLockAndAdvancesCase()
    {
        var (theCase, device) = Bundle();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, device.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        device.IsBusy.Should().BeTrue();
        theCase.Status.Should().Be(CaseStatus.PendingFeedback);
        await _sessions.Received(1).AddAsync(Arg.Any<FeedbackSession>(), Arg.Any<CancellationToken>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_HappyPath_PushesShowFeedbackAndDashboardUpdate()
    {
        var (theCase, device) = Bundle();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, device.Id.Value), CancellationToken.None);

        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "showFeedback", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).NotifyDashboardAsync(
            "device:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_BusyDevice_ReturnsConflict()
    {
        var (theCase, device) = Bundle();
        device.AcquireLock(StaffId.New(), CaseId.New(), TimeSpan.FromMinutes(1), _clock);
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, device.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("busy");
    }

    [Fact]
    public async Task HandleAsync_ExistingSessionOnOtherDevice_ReturnsConflict()
    {
        var (theCase, device) = Bundle();
        var otherDevice = DeviceId.New();
        var existing = FeedbackSession.Create(
            theCase.Id, StaffId.New(), otherDevice,
            expireAt: _clock.UtcNow + TimeSpan.FromMinutes(5),
            _clock);

        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _sessions.FindActiveByCaseAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, device.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("feedback_in_progress");
    }

    [Fact]
    public async Task HandleAsync_NotificationFails_StillReturnsSuccess()
    {
        var (theCase, device) = Bundle();
        _cases.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);
        _devices.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _notify.PushToDeviceAsync(Arg.Any<DeviceId>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));

        var result = await Handler(StaffId.New()).HandleAsync(
            new SendFeedbackCommand(theCase.Id.Value, device.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }
}
