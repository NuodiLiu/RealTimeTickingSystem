namespace Tickets.Domain.FeedbackSessions;

/// <summary>
/// Optional free-text comment from a customer. Trimmed, non-empty, max 1000 chars.
/// Application layer should call <see cref="Parse"/> only when raw input is
/// present; pass <c>null</c> to <c>FeedbackSession.Submit</c> when absent.
/// </summary>
public readonly record struct FeedbackComment
{
    public const int MaxLength = 1000;

    public string Value { get; }

    private FeedbackComment(string value) => Value = value;

    public static FeedbackComment Parse(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);

        var trimmed = raw.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new ArgumentException(
                $"Comment must be at most {MaxLength} characters; got {trimmed.Length}.",
                nameof(raw));
        }
        return new FeedbackComment(trimmed);
    }

    public override string ToString() => Value;
}
