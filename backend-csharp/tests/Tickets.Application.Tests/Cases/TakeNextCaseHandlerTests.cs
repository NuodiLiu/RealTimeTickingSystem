using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Cases;

public sealed class TakeNextCaseHandlerTests
{
    private readonly ICaseRepository _repo = Substitute.For<ICaseRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private TakeNextCaseHandler Handler(StaffId? staff = null) => new(
        _repo, _uow, _clock, _notify,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff),
        NullLogger<TakeNextCaseHandler>.Instance);

    private Case AQueuedCase() => Case.Queue(
        StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), _clock);

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new TakeNextCaseCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_EmptyQueue_ReturnsSuccessWithNull()
    {
        _repo.FindOldestQueuedAsync(Arg.Any<CancellationToken>()).Returns((Case?)null);

        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeNextCaseCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeNull();
        await _uow.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FirstAttemptSucceeds_TakesAndBroadcasts()
    {
        var staff = StaffId.New();
        var theCase = AQueuedCase();
        _repo.FindOldestQueuedAsync(Arg.Any<CancellationToken>()).Returns(theCase);

        var result = await Handler(staff)
            .HandleAsync(new TakeNextCaseCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.StaffId.Should().Be(staff.Value);
        result.Value.Status.Should().Be(CaseStatus.InProgress);
        await _notify.Received(1).NotifyDashboardAsync(
            "case:updated", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ConcurrencyConflict_RetriesAndSucceeds()
    {
        var first = AQueuedCase();
        var second = AQueuedCase();

        _repo.FindOldestQueuedAsync(Arg.Any<CancellationToken>())
            .Returns(first, second);

        // First Commit throws ConcurrencyError (peer beat us); second succeeds.
        var commitCalls = 0;
        _uow.CommitAsync(Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                commitCalls++;
                return commitCalls == 1
                    ? Task.FromException(new ConcurrencyError("Case", first.Id.ToString()))
                    : Task.CompletedTask;
            });

        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeNextCaseCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(second.Id.Value);
        commitCalls.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_AllAttemptsConflict_ReturnsContentionConflict()
    {
        _repo.FindOldestQueuedAsync(Arg.Any<CancellationToken>())
            .Returns(_ => AQueuedCase());
        _uow.CommitAsync(Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromException(new ConcurrencyError("Case", Guid.NewGuid().ToString())));

        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeNextCaseCommand(MaxAttempts: 2), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(409);
        result.Error.Code.Should().Be("queue_contention");
    }

    [Fact]
    public async Task HandleAsync_StaleRowLeftQueued_IsTreatedAsConcurrencyAndRetries()
    {
        // Domain Take() throws InvalidStateTransitionError when the case has
        // changed status between FindOldestQueued and the in-memory Take call.
        var alreadyTaken = AQueuedCase();
        alreadyTaken.Take(StaffId.New(), _clock);
        var fresh = AQueuedCase();

        _repo.FindOldestQueuedAsync(Arg.Any<CancellationToken>())
            .Returns(alreadyTaken, fresh);

        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeNextCaseCommand(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(fresh.Id.Value);
    }

    [Fact]
    public async Task HandleAsync_InvalidMaxAttempts_ReturnsValidationError()
    {
        var result = await Handler(StaffId.New())
            .HandleAsync(new TakeNextCaseCommand(MaxAttempts: 0), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }
}
