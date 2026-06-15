using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Handlers;
using Tickets.Application.Pairing.Validators;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;

namespace Tickets.Application.Tests.Pairing;

public sealed class CompletePairingHandlerTests
{
    private readonly IPairingTokenStore _store = Substitute.For<IPairingTokenStore>();
    private readonly IKioskDeviceRepository _devices = Substitute.For<IKioskDeviceRepository>();
    private readonly IDeviceSecretGenerator _secrets = Substitute.For<IDeviceSecretGenerator>();
    private readonly IDeviceTokenIssuer _tokens = Substitute.For<IDeviceTokenIssuer>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private CompletePairingHandler Handler() => new(
        _store, _devices, _secrets, _tokens, _uow, _clock, _notify,
        new CompletePairingCommandValidator(),
        Options.Create(new PairingQrOptions { ApiEndpoint = "https://api.example.test" }),
        NullLogger<CompletePairingHandler>.Instance);

    private void StubSecret()
    {
        _secrets.Generate().Returns(new DeviceSecret("plain-secret", SecretHash.FromRaw("hashbytes")));
    }

    [Fact]
    public async Task HandleAsync_BlankFields_ReturnsValidationError()
    {
        var result = await Handler().HandleAsync(
            new CompletePairingCommand("", "", "Registration"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
        await _store.DidNotReceive().ConsumeAsync(
            Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_InvalidMode_ReturnsValidationError()
    {
        var result = await Handler().HandleAsync(
            new CompletePairingCommand("tok", "Kiosk-1", "BogusMode"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }

    [Fact]
    public async Task HandleAsync_TokenAlreadyConsumed_ReturnsUnauthorized()
    {
        _store.ConsumeAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await Handler().HandleAsync(
            new CompletePairingCommand("stale", "Kiosk-1", "Registration"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
        result.Error.Code.Should().Be("invalid_pairing_token");
        await _devices.DidNotReceive().AddAsync(Arg.Any<KioskDevice>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NewDeviceName_CreatesAndReturnsApiKey()
    {
        _store.ConsumeAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _devices.FindActiveByNameAsync(Arg.Any<DeviceName>(), Arg.Any<CancellationToken>())
            .Returns((KioskDevice?)null);
        StubSecret();
        _tokens.IssueWebsocketToken(Arg.Any<DeviceId>(), Arg.Any<DeviceMode>(), Arg.Any<TimeSpan>())
            .Returns("ws-jwt");

        var result = await Handler().HandleAsync(
            new CompletePairingCommand("tok", "Kiosk-New", "Registration"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DeviceName.Should().Be("Kiosk-New");
        result.Value.Mode.Should().Be(DeviceMode.Registration);
        // B3: plaintext deviceSecret is returned (iPad PairCompleteResponse needs it).
        result.Value.DeviceSecret.Should().Be("plain-secret");
        result.Value.ApiKey.Should().EndWith(":plain-secret");
        result.Value.ApiKey.Should().Be($"{result.Value.DeviceId}:plain-secret");
        result.Value.WsToken.Should().Be("ws-jwt");
        await _devices.Received(1).AddAsync(Arg.Any<KioskDevice>(), Arg.Any<CancellationToken>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await _notify.Received(1).NotifyDashboardAsync(
            "device:paired", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SameNameExists_RotatesSecretOnExistingDevice()
    {
        var existing = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-Shared"),
            SecretHash.FromRaw("old-hash"),
            DeviceMode.Registration,
            _clock);
        var versionBefore = existing.Version;

        _store.ConsumeAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _devices.FindActiveByNameAsync(
                Arg.Is<DeviceName>(n => n == DeviceName.Parse("Kiosk-Shared")),
                Arg.Any<CancellationToken>())
            .Returns(existing);
        StubSecret();
        _tokens.IssueWebsocketToken(Arg.Any<DeviceId>(), Arg.Any<DeviceMode>(), Arg.Any<TimeSpan>())
            .Returns("ws-jwt");

        var result = await Handler().HandleAsync(
            new CompletePairingCommand("tok", "Kiosk-Shared", "Registration"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DeviceId.Should().Be(existing.Id.Value);
        existing.Version.Should().BeGreaterThan(versionBefore);
        await _devices.DidNotReceive().AddAsync(Arg.Any<KioskDevice>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SameNameExists_DifferentMode_AlsoSwitchesMode()
    {
        var existing = KioskDevice.Pair(
            DeviceName.Parse("Kiosk-Mode"),
            SecretHash.FromRaw("old-hash"),
            DeviceMode.Registration,
            _clock);

        _store.ConsumeAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _devices.FindActiveByNameAsync(Arg.Any<DeviceName>(), Arg.Any<CancellationToken>())
            .Returns(existing);
        StubSecret();
        _tokens.IssueWebsocketToken(Arg.Any<DeviceId>(), Arg.Any<DeviceMode>(), Arg.Any<TimeSpan>())
            .Returns("ws-jwt");

        var result = await Handler().HandleAsync(
            new CompletePairingCommand("tok", "Kiosk-Mode", "Feedback"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        existing.Mode.Should().Be(DeviceMode.Feedback);
    }

    [Fact]
    public async Task HandleAsync_NotificationFails_StillReturnsSuccess()
    {
        _store.ConsumeAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _devices.FindActiveByNameAsync(Arg.Any<DeviceName>(), Arg.Any<CancellationToken>())
            .Returns((KioskDevice?)null);
        StubSecret();
        _tokens.IssueWebsocketToken(Arg.Any<DeviceId>(), Arg.Any<DeviceMode>(), Arg.Any<TimeSpan>())
            .Returns("ws-jwt");
        _notify.NotifyDashboardAsync(Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));

        var result = await Handler().HandleAsync(
            new CompletePairingCommand("tok", "Kiosk-1", "Registration"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }
}
