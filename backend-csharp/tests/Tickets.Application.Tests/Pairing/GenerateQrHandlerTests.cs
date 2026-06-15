using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Pairing;

public sealed class GenerateQrHandlerTests
{
    private readonly IPairingTokenGenerator _gen = Substitute.For<IPairingTokenGenerator>();
    private readonly IPairingTokenStore _store = Substitute.For<IPairingTokenStore>();
    private readonly FakeClock _clock = new();

    private GenerateQrHandler Handler(StaffId? staff = null) => new(
        _gen, _store, _clock,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff));

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null).HandleAsync(
            new GenerateQrCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_HappyPath_PersistsTokenAndReturnsTicket()
    {
        _gen.Generate().Returns("abc123");

        var result = await Handler(StaffId.New()).HandleAsync(
            new GenerateQrCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PairingToken.Should().Be("abc123");
        result.Value.ExpireAt.Should().Be(_clock.UtcNow + TimeSpan.FromMinutes(5));
        await _store.Received(1).SaveAsync(
            "abc123", _clock.UtcNow + TimeSpan.FromMinutes(5), Arg.Any<CancellationToken>());
    }
}
