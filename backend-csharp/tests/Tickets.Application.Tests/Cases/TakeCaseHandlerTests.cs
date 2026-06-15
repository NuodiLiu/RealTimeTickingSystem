using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Cases;

public sealed class TakeCaseHandlerTests
{
    private readonly ICaseRepository _repo = Substitute.For<ICaseRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private TakeCaseHandler Handler(StaffId? staff = null) => new(
        _repo, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<TakeCaseHandler>.Instance);

    private Case AQueuedCase() => Case.Queue(
        StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new TakeCaseCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_CaseNotFound_Returns404()
    {
        _repo.FindByIdAsync(Arg.Any<CaseId>(), Arg.Any<CancellationToken>()).Returns((Case?)null);

        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeCaseCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(404);
        result.Error.Code.Should().Be("case_not_found");
    }

    [Fact]
    public async Task HandleAsync_QueuedCase_TransitionsToInProgressAndSaves()
    {
        var staff = StaffId.New();
        var theCase = AQueuedCase();
        _repo.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        var result = await Handler(staff)
            .HandleAsync(new TakeCaseCommand(theCase.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        theCase.Status.Should().Be(CaseStatus.InProgress);
        theCase.AssignedStaffId.Should().Be(staff);
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// api-cases.md pitfall #15 — when the case has already been taken by
    /// someone else, return 409 with a specific code rather than the legacy
    /// ambiguous "Case already taken or not in queue".
    /// </summary>
    [Fact]
    public async Task HandleAsync_AlreadyTaken_ReturnsConflict_WithDomainCode()
    {
        var theCase = AQueuedCase();
        theCase.Take(StaffId.New(), _clock);
        _repo.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeCaseCommand(theCase.Id.Value), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("invalid_state_transition");
    }

    [Fact]
    public async Task HandleAsync_OnSuccess_BroadcastsCaseUpdated()
    {
        var theCase = AQueuedCase();
        _repo.FindByIdAsync(theCase.Id, Arg.Any<CancellationToken>()).Returns(theCase);

        await Handler(StaffId.New())
            .HandleAsync(new TakeCaseCommand(theCase.Id.Value), CancellationToken.None);

        await _notify.Received(1).NotifyDashboardAsync(
            "case:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }
}
