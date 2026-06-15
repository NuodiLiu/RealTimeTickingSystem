using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Validators;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Cases;

public sealed class EscalateCaseHandlerTests
{
    private readonly ICaseRepository _repo = Substitute.For<ICaseRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private EscalateCaseHandler Handler(StaffId? staff = null) => new(
        _repo, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        new EscalateCaseCommandValidator(),
        NullLogger<EscalateCaseHandler>.Instance);

    private Case AnInProgressCase()
    {
        var c = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);
        c.Take(StaffId.New(), _clock);
        return c;
    }

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new EscalateCaseCommand(Guid.NewGuid(), "Finance", null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task HandleAsync_BlankDepartment_ReturnsValidationError(string dept)
    {
        var result = await Handler(StaffId.New())
            .HandleAsync(new EscalateCaseCommand(Guid.NewGuid(), dept, null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
        await _repo.DidNotReceive().FindByIdAsync(Arg.Any<CaseId>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_CaseNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<CaseId>(), Arg.Any<CancellationToken>()).Returns((Case?)null);

        var result = await Handler(StaffId.New())
            .HandleAsync(new EscalateCaseCommand(Guid.NewGuid(), "Finance", null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_FromQueued_ReturnsConflict()
    {
        var queued = Case.Queue(
            StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);
        _repo.FindByIdAsync(queued.Id, Arg.Any<CancellationToken>()).Returns(queued);

        var result = await Handler(StaffId.New())
            .HandleAsync(new EscalateCaseCommand(queued.Id.Value, "Finance", false), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("invalid_state_transition");
    }

    [Fact]
    public async Task HandleAsync_FromInProgress_RecordsMetadataAndBroadcasts()
    {
        var theCase = AnInProgressCase();
        _repo.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        var result = await Handler(StaffId.New()).HandleAsync(
            new EscalateCaseCommand(theCase.Id.Value, "Finance", true), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.EscalatedTo.Should().Be("Finance");
        result.Value.ResolvedOnSite.Should().Be(true);
        result.Value.Status.Should().Be(CaseStatus.InProgress); // status unchanged
        await _notify.Received(1).NotifyDashboardAsync(
            "case:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }
}
