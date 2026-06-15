using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Devices;

namespace Tickets.Application.Tests.Devices;

public sealed class IssueDeviceTokenHandlerTests
{
    private readonly IKioskDeviceRepository _repo = Substitute.For<IKioskDeviceRepository>();
    private readonly IAppJwtIssuer _issuer = Substitute.For<IAppJwtIssuer>();
    private readonly FakeClock _clock = new();

    private IssueDeviceTokenHandler Handler(DeviceId? device = null) => new(
        _repo,
        device is null ? FakeCurrentDevice.AnonymousDevice() : FakeCurrentDevice.Identified(device),
        _issuer);

    private KioskDevice APairedDevice() => KioskDevice.Pair(
        DeviceName.Parse("Kiosk-01"), SecretHash.FromRaw("hash"), DeviceMode.Feedback, _clock);

    [Fact]
    public async Task HandleAsync_AnonymousDevice_Unauthorized()
    {
        var result = await Handler(device: null)
            .HandleAsync(new IssueDeviceTokenCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
        _issuer.DidNotReceive().IssueDeviceToken(Arg.Any<DeviceId>(), Arg.Any<DeviceMode>());
    }

    [Fact]
    public async Task HandleAsync_DeviceNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<DeviceId>(), Arg.Any<CancellationToken>())
            .Returns((KioskDevice?)null);

        var result = await Handler(DeviceId.New())
            .HandleAsync(new IssueDeviceTokenCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_UnpairedDevice_Returns404()
    {
        var device = APairedDevice();
        device.Unpair(_clock);
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);

        var result = await Handler(device.Id)
            .HandleAsync(new IssueDeviceTokenCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PairedDevice_ReturnsAppJwtAndExpiry_ForThatDevice()
    {
        var device = APairedDevice();
        var expireAt = _clock.UtcNow.AddHours(12);
        _repo.FindByIdAsync(device.Id, Arg.Any<CancellationToken>()).Returns(device);
        _issuer.IssueDeviceToken(device.Id, device.Mode)
            .Returns(new AppJwt("signed-device-jwt", expireAt));

        var result = await Handler(device.Id)
            .HandleAsync(new IssueDeviceTokenCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AppJwt.Should().Be("signed-device-jwt");
        result.Value.ExpiresAt.Should().Be(expireAt);
        // Device id + mode come from the authenticated device, not the request.
        _issuer.Received(1).IssueDeviceToken(device.Id, DeviceMode.Feedback);
    }
}
