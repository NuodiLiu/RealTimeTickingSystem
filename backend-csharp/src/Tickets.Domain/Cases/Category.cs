namespace Tickets.Domain.Cases;

/// <summary>
/// Free-form category label, trimmed and capped at 64 chars.
/// <para>
/// Future improvement: replace with an enum or DB-backed dictionary once the
/// product team finalizes the category list (api-cases.md pitfall #8).
/// </para>
/// </summary>
public readonly record struct Category
{
    public const int MaxLength = 64;

    public string Value { get; }

    private Category(string value) => Value = value;

    public static Category Parse(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);

        var trimmed = raw.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new ArgumentException(
                $"Category must be at most {MaxLength} characters; got {trimmed.Length}.",
                nameof(raw));
        }
        return new Category(trimmed);
    }

    public override string ToString() => Value;
}
