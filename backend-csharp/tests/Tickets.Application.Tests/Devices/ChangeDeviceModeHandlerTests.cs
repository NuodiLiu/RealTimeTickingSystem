using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Devices;

public sealed class ChangeDeviceModeHandlerTests
{
    private readonly IKioskDeviceRepository _repo = Substitute.For<IKioskDeviceRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private ChangeDeviceModeHandler Handler(StaffId? staff = null) => new(
        _repo, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<ChangeDeviceModeHandler>.Instance);

    private KioskDevice AnIdleDevice() => KioskDevice.Pair(
        DeviceName.Parse("Kiosk-01"),
        SecretHash.FromRaw("hash"),
        DeviceMode.Registration,
        _clock);

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null).HandleAsync(
            new ChangeDeviceModeCommand(Guid.NewGuid(), "Feedback"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Theory]
    [InlineData("FOO")]
    [InlineData("")]
    public async Task HandleAsync_InvalidMode_ReturnsValidationError(string mode)
    {
        var result = await Handler(StaffId.New()).HandleAsync(
            new ChangeDeviceModeCommand(Guid.NewGuid(), mode),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
        await _repo.DidNotReceive().FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_DeviceNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>())
            .Returns((KioskDevice?)null);

        var result = await Handler(StaffId.New()).HandleAsync(
            new ChangeDeviceModeCommand(Guid.NewGuid(), "Feedback"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_IdleDevice_SwitchesAndBroadcastsAndPushes()
    {
        var device = AnIdleDevice();
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New()).HandleAsync(
            new ChangeDeviceModeCommand(device.Id.Value, "feedback"),  // case-insensitive
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Mode.Should().Be("Feedback");
        await _notify.Received(1).NotifyDashboardAsync(
            "device:mode_changed", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "changeMode", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_BusyDevice_ReturnsConflict()
    {
        var device = AnIdleDevice();
        device.AcquireLock(StaffId.New(), CaseId.New(), TimeSpan.FromMinutes(1), _clock);
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New()).HandleAsync(
            new ChangeDeviceModeCommand(device.Id.Value, "Feedback"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("busy");
    }

    /// <summary>
    /// api-device.md pitfall #6 — legacy let dashboard SignalR failure surface
    /// as 500 while iPad push was swallowed. New handler: both are best-effort.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotificationFails_StillReturnsSuccess()
    {
        var device = AnIdleDevice();
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _notify.NotifyDashboardAsync(Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));
        _notify.PushToDeviceAsync(
            Arg.Any<DeviceId>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));

        var result = await Handler(StaffId.New()).HandleAsync(
            new ChangeDeviceModeCommand(device.Id.Value, "Feedback"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }
}
