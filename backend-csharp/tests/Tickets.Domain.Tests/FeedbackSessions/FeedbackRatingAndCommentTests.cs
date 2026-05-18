using Tickets.Domain.FeedbackSessions;

namespace Tickets.Domain.Tests.FeedbackSessions;

public sealed class FeedbackRatingAndCommentTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(5)]
    public void Rating_InRange_OK(int value)
    {
        FeedbackRating.From(value).Value.Should().Be(value);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(6)]
    [InlineData(100)]
    public void Rating_OutOfRange_Throws(int value)
    {
        var act = () => FeedbackRating.From(value);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Comment_Parse_TrimsAndStores()
    {
        FeedbackComment.Parse("  Great service!  ").Value.Should().Be("Great service!");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Comment_BlankInput_Throws(string raw)
    {
        var act = () => FeedbackComment.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Comment_TooLong_Throws()
    {
        var raw = new string('a', FeedbackComment.MaxLength + 1);
        var act = () => FeedbackComment.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Comment_AtMaxLength_OK()
    {
        var raw = new string('a', FeedbackComment.MaxLength);
        FeedbackComment.Parse(raw).Value.Should().HaveLength(FeedbackComment.MaxLength);
    }
}
