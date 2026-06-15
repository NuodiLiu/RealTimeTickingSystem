namespace Tickets.Domain.FeedbackSessions;

/// <summary>
/// Customer satisfaction rating on a 1-5 integer scale.
/// </summary>
public readonly record struct FeedbackRating
{
    public const int MinValue = 1;
    public const int MaxValue = 5;

    public int Value { get; }

    private FeedbackRating(int value) => Value = value;

    public static FeedbackRating From(int value)
    {
        if (value is < MinValue or > MaxValue)
        {
            throw new ArgumentException(
                $"Rating must be in [{MinValue}, {MaxValue}]; got {value}.",
                nameof(value));
        }
        return new FeedbackRating(value);
    }

    public override string ToString() => Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
}
