using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Queries;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;

namespace Tickets.Application.Tests.Cases;

public sealed class GetPublicQueueHandlerTests
{
    private readonly ICaseRepository _repo = Substitute.For<ICaseRepository>();

    private static Case AQueuedCase(FakeClock clock) => Case.Queue(
        StudentName.Parse("Liam"),
        Category.Parse("Technical"),
        zId: null,
        createdByDeviceId: DeviceId.New(),
        clock);

    private GetPublicQueueHandler Handler() => new(_repo);

    [Fact]
    public async Task HandleAsync_ReturnsEntries_WithPositionStartingAtOne()
    {
        var clock = new FakeClock();
        var a = AQueuedCase(clock);
        clock.Advance(TimeSpan.FromSeconds(1));
        var b = AQueuedCase(clock);
        _repo.ListByStatusAsync(CaseStatus.Queued, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new[] { a, b });

        var result = await Handler().HandleAsync(new GetPublicQueueQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value![0].Position.Should().Be(1);
        result.Value[1].Position.Should().Be(2);
        result.Value[0].Status.Should().Be("Queued");
    }

    [Fact]
    public async Task HandleAsync_EmptyQueue_ReturnsEmptyList()
    {
        _repo.ListByStatusAsync(CaseStatus.Queued, 0, 50, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Case>());

        var result = await Handler().HandleAsync(new GetPublicQueueQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(201)]
    public async Task HandleAsync_InvalidMaxResults_ReturnsValidationError(int max)
    {
        var result = await Handler().HandleAsync(new GetPublicQueueQuery(max), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
        await _repo.DidNotReceive().ListByStatusAsync(
            Arg.Any<CaseStatus>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_RespectsCustomMaxResults()
    {
        _repo.ListByStatusAsync(CaseStatus.Queued, 0, 10, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Case>());

        await Handler().HandleAsync(new GetPublicQueueQuery(MaxResults: 10), CancellationToken.None);

        await _repo.Received(1).ListByStatusAsync(
            CaseStatus.Queued, 0, 10, Arg.Any<CancellationToken>());
    }
}
