using Microsoft.Extensions.Options;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Auth.Commands;
using Tickets.Application.Auth.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Auth;

public sealed class RefreshTokenHandlerTests
{
    private readonly IRefreshHandleStore _store = Substitute.For<IRefreshHandleStore>();
    private readonly IStaffRepository _repo = Substitute.For<IStaffRepository>();
    private readonly IAppJwtIssuer _issuer = Substitute.For<IAppJwtIssuer>();
    private readonly FakeClock _clock = new();
    private readonly AppJwtOptions _options = new() { RefreshTtl = TimeSpan.FromDays(14) };

    private RefreshTokenHandler Handler() => new(
        _store, _repo, _issuer, _clock, Options.Create(_options));

    private static Staff AStaff()
    {
        var clock = new FakeClock();
        return Staff.Provision(
            IdentityKey.FromAzureAd("tid", "oid12345"),
            EmailAddress.Parse("liam@example.com"),
            EmployeeNo.ForAzureAd("tid", "oid12345"),
            displayName: "Liam",
            clock);
    }

    [Fact]
    public async Task HandleAsync_BlankHandle_ReturnsUnauthorized()
    {
        var result = await Handler().HandleAsync(
            new RefreshTokenCommand(""), CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
        result.Error.Code.Should().Be("missing_refresh");
    }

    [Fact]
    public async Task HandleAsync_UnknownHandle_ReturnsUnauthorized()
    {
        _store.FindAsync("bad", Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns((RefreshHandleRecord?)null);

        var result = await Handler().HandleAsync(
            new RefreshTokenCommand("bad"), CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
        result.Error.Code.Should().Be("invalid_refresh");
    }

    [Fact]
    public async Task HandleAsync_StaffDeleted_DeletesHandleAndReturns401()
    {
        var staffId = StaffId.New();
        _store.FindAsync("h", Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new RefreshHandleRecord(staffId, _clock.UtcNow + TimeSpan.FromDays(1)));
        _repo.FindByIdAsync(staffId, Arg.Any<CancellationToken>()).Returns((Staff?)null);

        var result = await Handler().HandleAsync(
            new RefreshTokenCommand("h"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
        await _store.Received(1).DeleteAsync("h", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_HappyPath_RotatesAndReturnsTokens()
    {
        var staff = AStaff();
        _store.FindAsync("old", Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new RefreshHandleRecord(staff.Id, _clock.UtcNow + TimeSpan.FromDays(1)));
        _repo.FindByIdAsync(staff.Id, Arg.Any<CancellationToken>()).Returns(staff);
        _store.RotateAsync("old", Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns("new-handle");
        _issuer.Issue(staff.Id, staff.Role).Returns(
            new AppJwt("jwt-token", _clock.UtcNow + TimeSpan.FromHours(2)));

        var result = await Handler().HandleAsync(
            new RefreshTokenCommand("old"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AccessToken.Should().Be("jwt-token");
        result.Value.RefreshHandle.Should().Be("new-handle");
    }

    [Fact]
    public async Task HandleAsync_RotationFailsConcurrently_Returns401()
    {
        var staff = AStaff();
        _store.FindAsync("old", Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new RefreshHandleRecord(staff.Id, _clock.UtcNow + TimeSpan.FromDays(1)));
        _repo.FindByIdAsync(staff.Id, Arg.Any<CancellationToken>()).Returns(staff);
        _store.RotateAsync("old", Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns((string?)null);

        var result = await Handler().HandleAsync(
            new RefreshTokenCommand("old"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be("refresh_race");
    }
}
