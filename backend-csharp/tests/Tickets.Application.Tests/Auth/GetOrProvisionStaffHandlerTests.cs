using Tickets.Application.Auth.Commands;
using Tickets.Application.Auth.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Auth;

public sealed class GetOrProvisionStaffHandlerTests
{
    private readonly IStaffRepository _repo = Substitute.For<IStaffRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly FakeClock _clock = new();

    private const string Tid = "11111111-1111-1111-1111-111111111111";
    private const string Oid = "22222222-2222-2222-2222-222222222222";
    private const string Email = "liam@example.com";

    private GetOrProvisionStaffHandler Handler() => new(_repo, _uow, _clock);

    [Theory]
    [InlineData("", Oid)]
    [InlineData(Tid, "")]
    public async Task HandleAsync_MissingTenantOrObjectId_ReturnsValidationError(string tid, string oid)
    {
        var result = await Handler().HandleAsync(
            new GetOrProvisionStaffCommand(tid, oid, Email, "Liam"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }

    [Fact]
    public async Task HandleAsync_StaffMatchesByIdentityKey_RefreshesProfileAndReturns()
    {
        var key = IdentityKey.FromAzureAd(Tid, Oid);
        var existing = Staff.Provision(
            key, EmailAddress.Parse(Email), EmployeeNo.ForAzureAd(Tid, Oid),
            displayName: "Old Name", _clock);
        existing.ClearDomainEvents();
        _repo.FindByIdentityKeyAsync(key, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await Handler().HandleAsync(
            new GetOrProvisionStaffCommand(Tid, Oid, Email, "Liam Liu"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(existing.Id.Value);
        existing.Name.Should().Be("Liam Liu");
        await _repo.DidNotReceive().AddAsync(Arg.Any<Staff>(), Arg.Any<CancellationToken>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_StaffMatchesByEmail_MigratesIdentityKey()
    {
        var oldKey = IdentityKey.FromAzureAd(
            "99999999-9999-9999-9999-999999999999",
            "88888888-8888-8888-8888-888888888888");
        var newKey = IdentityKey.FromAzureAd(Tid, Oid);

        var existing = Staff.Provision(
            oldKey, EmailAddress.Parse(Email), EmployeeNo.ForAzureAd(Tid, Oid),
            displayName: "Liam", _clock);
        _repo.FindByIdentityKeyAsync(newKey, Arg.Any<CancellationToken>()).Returns((Staff?)null);
        _repo.FindByEmailAsync(EmailAddress.Parse(Email), Arg.Any<CancellationToken>()).Returns(existing);

        var result = await Handler().HandleAsync(
            new GetOrProvisionStaffCommand(Tid, Oid, Email, "Liam"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        existing.IdentityKey.Should().Be(newKey);
    }

    [Fact]
    public async Task HandleAsync_FirstLogin_CreatesNewStaff()
    {
        _repo.FindByIdentityKeyAsync(Arg.Any<IdentityKey>(), Arg.Any<CancellationToken>())
            .Returns((Staff?)null);
        _repo.FindByEmailAsync(Arg.Any<EmailAddress>(), Arg.Any<CancellationToken>())
            .Returns((Staff?)null);

        var result = await Handler().HandleAsync(
            new GetOrProvisionStaffCommand(Tid, Oid, Email, "Liam"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Email.Should().Be(Email);
        await _repo.Received(1).AddAsync(Arg.Any<Staff>(), Arg.Any<CancellationToken>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FirstLogin_MissingEmail_ReturnsValidationError()
    {
        _repo.FindByIdentityKeyAsync(Arg.Any<IdentityKey>(), Arg.Any<CancellationToken>())
            .Returns((Staff?)null);

        var result = await Handler().HandleAsync(
            new GetOrProvisionStaffCommand(Tid, Oid, Email: null, "Liam"),
            CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }
}
