namespace Tickets.Domain.FeedbackSessions;

/// <summary>
/// Strongly-typed identifier for the <c>FeedbackSession</c> aggregate.
/// <para>
/// Defined ahead of the full aggregate so <c>Case</c> events can carry the
/// session id without taking a dependency on the not-yet-built aggregate.
/// </para>
/// </summary>
public readonly record struct FeedbackSessionId(Guid Value)
{
    public static FeedbackSessionId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
