using Microsoft.Extensions.Logging.Abstractions;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Validators;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Abstractions;

namespace Tickets.Application.Tests.Cases;

public sealed class PostCaseHandlerTests
{
    private readonly ICaseRepository _repo = Substitute.For<ICaseRepository>();
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly INotificationGateway _notify = Substitute.For<INotificationGateway>();
    private readonly FakeClock _clock = new();

    private PostCaseHandler Handler() => new(
        _repo, _uow, _clock, _notify,
        new PostCaseCommandValidator(),
        NullLogger<PostCaseHandler>.Instance);

    [Fact]
    public async Task HandleAsync_ValidCommand_Succeeds_AndPersists()
    {
        var deviceId = Guid.NewGuid();
        var cmd = new PostCaseCommand("Liam", "Technical", "z1234567", deviceId);

        var result = await Handler().HandleAsync(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.StudentName.Should().Be("Liam");
        result.Value.Category.Should().Be("Technical");
        result.Value.ZId.Should().Be("z1234567");
        result.Value.CreatedByDeviceId.Should().Be(deviceId);
        result.Value.Status.Should().Be(CaseStatus.Queued);

        await _repo.Received(1).AddAsync(Arg.Any<Case>(), Arg.Any<CancellationToken>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ValidCommand_BroadcastsCaseCreatedEvent()
    {
        var cmd = new PostCaseCommand("Liam", "Technical", null, Guid.NewGuid());

        await Handler().HandleAsync(cmd, CancellationToken.None);

        await _notify.Received(1).NotifyDashboardAsync(
            "case:created",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// AGENTS.md §7 #6: notification failures must never surface as request
    /// failure. Fixes api-cases.md pitfall #4.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotificationThrows_StillReturnsSuccess()
    {
        _notify
            .NotifyDashboardAsync(Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR down")));

        var cmd = new PostCaseCommand("Liam", "Technical", null, Guid.NewGuid());
        var result = await Handler().HandleAsync(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("", "Technical", "studentName is required.")]
    [InlineData("Liam", "", "category is required.")]
    [InlineData("Liam", "Technical", "")]    // empty zId allowed (treated as omitted)
    public async Task HandleAsync_RequiredFieldsMissing_ReturnsValidationError(
        string name, string category, string expectedMessageSubstringOrEmpty)
    {
        var cmd = new PostCaseCommand(name, category, null, Guid.NewGuid());

        var result = await Handler().HandleAsync(cmd, CancellationToken.None);

        if (string.IsNullOrEmpty(expectedMessageSubstringOrEmpty))
        {
            result.IsSuccess.Should().BeTrue();
        }
        else
        {
            result.IsSuccess.Should().BeFalse();
            result.Error!.Code.Should().Be("invalid_request");
            result.Error.HttpStatus.Should().Be(400);
            result.Error.Description.Should().Contain(expectedMessageSubstringOrEmpty);
        }
    }

    [Theory]
    [InlineData("not-a-zid")]
    [InlineData("z123")]              // too short
    [InlineData("z1234567890")]       // too long
    public async Task HandleAsync_InvalidZId_ReturnsValidationError(string badZid)
    {
        var cmd = new PostCaseCommand("Liam", "Technical", badZid, Guid.NewGuid());

        var result = await Handler().HandleAsync(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
        await _repo.DidNotReceive().AddAsync(Arg.Any<Case>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_OmittedZId_PersistsWithNullZId()
    {
        var cmd = new PostCaseCommand("Liam", "Technical", null, null);

        var result = await Handler().HandleAsync(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ZId.Should().BeNull();
        result.Value.CreatedByDeviceId.Should().BeNull();
    }
}
