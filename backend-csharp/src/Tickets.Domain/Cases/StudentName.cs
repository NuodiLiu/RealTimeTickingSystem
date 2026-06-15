namespace Tickets.Domain.Cases;

/// <summary>
/// Student's display name on a case. Trimmed, non-empty, max 128 chars.
/// </summary>
public readonly record struct StudentName
{
    public const int MaxLength = 128;

    public string Value { get; }

    private StudentName(string value) => Value = value;

    public static StudentName Parse(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);

        var trimmed = raw.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new ArgumentException(
                $"Student name must be at most {MaxLength} characters; got {trimmed.Length}.",
                nameof(raw));
        }

        return new StudentName(trimmed);
    }

    public override string ToString() => Value;
}
