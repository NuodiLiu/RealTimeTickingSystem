using System.Globalization;

namespace Tickets.Domain.Cases;

/// <summary>
/// UNSW student identifier. Format: <c>z</c> followed by 6-8 digits
/// (e.g. <c>z1234567</c>). Stored lower-cased and trimmed.
/// <para>
/// Optional on a <see cref="Case"/>; callers should use <see cref="TryParse"/>
/// when accepting user input and pass <c>null</c> if absent.
/// </para>
/// </summary>
public readonly record struct ZId
{
    public string Value { get; }

    private ZId(string value) => Value = value;

    public static ZId Parse(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);

        var trimmed = raw.Trim().ToLower(CultureInfo.InvariantCulture);
        if (trimmed.Length is < 7 or > 9 || trimmed[0] != 'z')
        {
            throw new ArgumentException(
                $"ZId must start with 'z' followed by 6-8 digits; got '{raw}'.",
                nameof(raw));
        }
        for (var i = 1; i < trimmed.Length; i++)
        {
            if (!char.IsAsciiDigit(trimmed[i]))
            {
                throw new ArgumentException(
                    $"ZId must contain only digits after 'z'; got '{raw}'.",
                    nameof(raw));
            }
        }

        return new ZId(trimmed);
    }

    public static bool TryParse(string? raw, out ZId zid)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            zid = default;
            return false;
        }
        try
        {
            zid = Parse(raw);
            return true;
        }
        catch (ArgumentException)
        {
            zid = default;
            return false;
        }
    }

    public override string ToString() => Value;
}
