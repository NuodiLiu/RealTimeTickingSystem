using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;

namespace Tickets.Application.Tests.Devices;

public sealed class RecordHeartbeatHandlerTests
{
    private readonly IKioskDeviceRepository _repo = Substitute.For<IKioskDeviceRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly FakeClock _clock = new();

    private RecordHeartbeatHandler Handler(DeviceId? device = null) => new(
        _repo, _uow, _clock,
        device is null ? FakeCurrentDevice.AnonymousDevice() : FakeCurrentDevice.Identified(device));

    private KioskDevice APairedDevice() => KioskDevice.Pair(
        DeviceName.Parse("Kiosk-01"), SecretHash.FromRaw("hash"), DeviceMode.Registration, _clock);

    [Fact]
    public async Task HandleAsync_AnonymousDevice_Unauthorized()
    {
        var result = await Handler(device: null)
            .HandleAsync(new RecordHeartbeatCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_DeviceNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>())
            .Returns((KioskDevice?)null);

        var result = await Handler(DeviceId.New())
            .HandleAsync(new RecordHeartbeatCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_FirstHeartbeat_FlipsConnectedAndCommits()
    {
        var device = APairedDevice();
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(device.Id)
            .HandleAsync(new RecordHeartbeatCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        // The HTTP response is the iPad heartbeat DTO: an idle device with no
        // active lock reports status "IDLE" and success=true. The connection
        // flip is a domain concern covered by KioskDevice tests.
        result.Value!.Success.Should().BeTrue();
        result.Value.Status.Should().Be("IDLE");
        device.IsConnected.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_UnpairedDevice_ReturnsConflict()
    {
        var device = APairedDevice();
        device.Unpair(_clock);
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(device.Id)
            .HandleAsync(new RecordHeartbeatCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("device_not_paired");
    }
}
