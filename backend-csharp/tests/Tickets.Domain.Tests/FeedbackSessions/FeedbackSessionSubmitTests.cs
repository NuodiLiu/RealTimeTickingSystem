using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.FeedbackSessions.Events;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.FeedbackSessions;

public sealed class FeedbackSessionSubmitTests
{
    [Fact]
    public void Submit_FromDelivered_TransitionsToSubmittedAndRecordsRatingComment()
    {
        var clock = new FakeClock();
        var session = FeedbackSessionTestData.ADeliveredSession(clock);
        session.ClearDomainEvents();
        clock.Advance(TimeSpan.FromSeconds(30));

        var rating = FeedbackRating.From(4);
        var comment = FeedbackComment.Parse("Helpful staff, thanks!");
        session.Submit(rating, comment, clock);

        session.Status.Should().Be(FeedbackSessionStatus.Submitted);
        session.SubmittedAt.Should().Be(clock.UtcNow);
        session.Rating.Should().Be(rating);
        session.Comment.Should().Be(comment);

        var evt = session.DomainEvents.OfType<FeedbackSessionSubmitted>().Single();
        evt.Rating.Should().Be(rating);
        evt.Comment.Should().Be(comment);
        evt.SubmittedAt.Should().Be(clock.UtcNow);
    }

    [Fact]
    public void Submit_WithoutComment_OK()
    {
        var clock = new FakeClock();
        var session = FeedbackSessionTestData.ADeliveredSession(clock);

        session.Submit(FeedbackRating.From(3), comment: null, clock);

        session.Comment.Should().BeNull();
        session.DomainEvents.OfType<FeedbackSessionSubmitted>().Single().Comment.Should().BeNull();
    }

    /// <summary>
    /// AGENTS.md §4.2 — domain disallows skipping Delivered. Application layer
    /// must ConfirmDelivery + Submit when iPad's ACK is missing.
    /// </summary>
    [Fact]
    public void Submit_FromCreated_Throws()
    {
        var clock = new FakeClock();
        var session = FeedbackSessionTestData.ACreatedSession(clock);

        var act = () => session.Submit(FeedbackRating.From(5), comment: null, clock);

        act.Should().Throw<InvalidStateTransitionError>();
    }

    [Theory]
    [InlineData(FeedbackSessionStatus.Submitted)]
    [InlineData(FeedbackSessionStatus.Cancelled)]
    [InlineData(FeedbackSessionStatus.Overridden)]
    [InlineData(FeedbackSessionStatus.Expired)]
    public void Submit_FromTerminalStatus_Throws(FeedbackSessionStatus startingStatus)
    {
        var session = SessionInStatus(startingStatus);
        var act = () => session.Submit(FeedbackRating.From(5), comment: null, new FakeClock());
        act.Should().Throw<InvalidStateTransitionError>();
    }

    private static FeedbackSession SessionInStatus(FeedbackSessionStatus status) => status switch
    {
        FeedbackSessionStatus.Created => FeedbackSessionTestData.ACreatedSession(),
        FeedbackSessionStatus.Delivered => FeedbackSessionTestData.ADeliveredSession(),
        FeedbackSessionStatus.Submitted => FeedbackSessionTestData.ASubmittedSession(),
        FeedbackSessionStatus.Cancelled => FeedbackSessionTestData.ACancelledSession(),
        FeedbackSessionStatus.Overridden => FeedbackSessionTestData.AnOverriddenSession(),
        FeedbackSessionStatus.Expired => FeedbackSessionTestData.AnExpiredSession(),
        _ => throw new ArgumentOutOfRangeException(nameof(status)),
    };
}
