using Tickets.Application.Auth.Handlers;
using Tickets.Application.Auth.Queries;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Auth;

public sealed class GetCurrentStaffHandlerTests
{
    private readonly IStaffRepository _repo = Substitute.For<IStaffRepository>();

    private GetCurrentStaffHandler Handler(StaffId? staff = null) => new(
        _repo,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff));

    private static Staff AStaff(IClock clock) => Staff.Provision(
        IdentityKey.FromAzureAd("tid", "oid12345"),
        EmailAddress.Parse("liam@example.com"),
        EmployeeNo.ForAzureAd("tid", "oid12345"),
        displayName: "Liam",
        clock);

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new GetCurrentStaffQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_StaffNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<StaffId>(), Arg.Any<CancellationToken>()).Returns((Staff?)null);

        var result = await Handler(StaffId.New())
            .HandleAsync(new GetCurrentStaffQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
        result.Error.Code.Should().Be("staff_not_found");
    }

    [Fact]
    public async Task HandleAsync_StaffExists_ReturnsDto()
    {
        var clock = new FakeClock();
        var s = AStaff(clock);
        _repo.FindByIdAsync(s.Id, Arg.Any<CancellationToken>()).Returns(s);

        var result = await Handler(s.Id)
            .HandleAsync(new GetCurrentStaffQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(s.Id.Value);
        result.Value.Name.Should().Be("Liam");
    }
}
