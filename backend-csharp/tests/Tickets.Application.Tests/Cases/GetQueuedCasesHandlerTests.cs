using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Queries;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Cases;

public sealed class GetQueuedCasesHandlerTests
{
    private readonly ICaseRepository _repo = Substitute.For<ICaseRepository>();

    private static Case AQueuedCase(FakeClock clock) => Case.Queue(
        StudentName.Parse("Liam"), Category.Parse("Tech"), null, DeviceId.New(), clock);

    private GetQueuedCasesHandler Handler(StaffId? staffId = null) => new(
        _repo,
        staffId is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staffId));

    [Fact]
    public async Task HandleAsync_Anonymous_ReturnsUnauthorized()
    {
        var result = await Handler(staffId: null)
            .HandleAsync(new GetQueuedCasesQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_StaffWithDefaults_QueriesQueuedFirstPage()
    {
        _repo.ListByStatusAsync(CaseStatus.Queued, 0, 50, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Case>());

        var result = await Handler(StaffId.New())
            .HandleAsync(new GetQueuedCasesQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _repo.Received(1).ListByStatusAsync(
            CaseStatus.Queued, 0, 50, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, 50)]
    [InlineData(1, 0)]
    [InlineData(1, 201)]
    public async Task HandleAsync_InvalidPagination_ReturnsValidationError(int page, int size)
    {
        var result = await Handler(StaffId.New())
            .HandleAsync(new GetQueuedCasesQuery(Page: page, PageSize: size), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }

    [Fact]
    public async Task HandleAsync_Page2_SkipsFirstPageSize()
    {
        _repo.ListByStatusAsync(CaseStatus.InProgress, 50, 50, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Case>());

        await Handler(StaffId.New()).HandleAsync(
            new GetQueuedCasesQuery(CaseStatus.InProgress, Page: 2, PageSize: 50),
            CancellationToken.None);

        await _repo.Received(1).ListByStatusAsync(
            CaseStatus.InProgress, 50, 50, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ReturnsCaseDtos()
    {
        var clock = new FakeClock();
        var c = AQueuedCase(clock);
        _repo.ListByStatusAsync(CaseStatus.Queued, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new[] { c });

        var result = await Handler(StaffId.New())
            .HandleAsync(new GetQueuedCasesQuery(), CancellationToken.None);

        result.Value!.Should().ContainSingle()
            .Which.StudentName.Should().Be("Liam");
    }
}
