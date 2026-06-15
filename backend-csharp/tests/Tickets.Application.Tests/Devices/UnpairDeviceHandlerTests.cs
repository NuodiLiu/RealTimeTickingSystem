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

public sealed class UnpairDeviceHandlerTests
{
    private readonly IKioskDeviceRepository _repo = Substitute.For<IKioskDeviceRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private UnpairDeviceHandler Handler(StaffId? staff = null) => new(
        _repo, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<UnpairDeviceHandler>.Instance);

    private KioskDevice APairedDevice() => KioskDevice.Pair(
        DeviceName.Parse("Kiosk-Unpair"),
        SecretHash.FromRaw("hash"),
        DeviceMode.Registration,
        _clock);

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new UnpairDeviceCommand(Guid.NewGuid()), CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_DeviceNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>())
            .Returns((KioskDevice?)null);
        var result = await Handler(StaffId.New())
            .HandleAsync(new UnpairDeviceCommand(Guid.NewGuid()), CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_IdleDevice_UnpairsAndPushesNotifications()
    {
        var device = APairedDevice();
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New())
            .HandleAsync(new UnpairDeviceCommand(device.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        device.PairingStatus.Should().Be(PairingStatus.Unpaired);
        device.SecretHash.IsCleared.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await _notify.Received(1).PushToDeviceAsync(
            device.Id, "UNPAIRED", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await _notify.Received(1).NotifyDashboardAsync(
            "device:unpaired", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_BusyDevice_ReturnsConflict()
    {
        var device = APairedDevice();
        device.AcquireLock(StaffId.New(), CaseId.New(), TimeSpan.FromMinutes(1), _clock);
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(StaffId.New())
            .HandleAsync(new UnpairDeviceCommand(device.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("busy");
    }
}
