using Microsoft.Extensions.Options;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Pairing;

public sealed class GenerateQrHandlerTests
{
    private const string ApiEndpoint = "https://api.example.test";

    private readonly IPairingTokenGenerator _gen = Substitute.For<IPairingTokenGenerator>();
    private readonly IPairingTokenStore _store = Substitute.For<IPairingTokenStore>();
    private readonly FakeClock _clock = new();

    private GenerateQrHandler Handler(StaffId? staff = null) => new(
        _gen, _store, _clock,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        Options.Create(new PairingQrOptions { ApiEndpoint = ApiEndpoint }));

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
        result.Value.SessionId.Should().Be("abc123");
        result.Value.ExpiresAt.Should().Be(_clock.UtcNow + TimeSpan.FromMinutes(5));
        await _store.Received(1).SaveAsync(
            "abc123", _clock.UtcNow + TimeSpan.FromMinutes(5), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_QrUrl_ContainsPairDataWithTokenAndApiEndpoint()
    {
        _gen.Generate().Returns("tok-xyz");

        var result = await Handler(StaffId.New()).HandleAsync(
            new GenerateQrCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var qrUrl = result.Value!.QrUrl;

        // iPad's extractPairingData requires the literal "/pair?data=" substring.
        qrUrl.Should().StartWith($"{ApiEndpoint}/pair?data=");

        // The data param must URL-decode to JSON carrying pairingToken + apiEndpoint.
        var dataParam = System.Web.HttpUtility.ParseQueryString(
            new Uri(qrUrl).Query)["data"]!;
        using var doc = System.Text.Json.JsonDocument.Parse(dataParam);
        doc.RootElement.GetProperty("pairingToken").GetString().Should().Be("tok-xyz");
        doc.RootElement.GetProperty("apiEndpoint").GetString().Should().Be(ApiEndpoint);
    }
}
