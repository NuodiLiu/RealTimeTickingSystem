using System.Globalization;

namespace Tickets.Domain.Shared.ValueObjects;

/// <summary>
/// Normalized email address (trimmed + lowercased), guaranteed to look like an email.
/// <para>
/// Mirrors the existing normalization helper at backend/src/lib/email-utils.ts
/// (api-auth.md) — the Staff aggregate uses this as its case-insensitive unique key.
/// </para>
/// </summary>
public readonly record struct EmailAddress
{
    public string Value { get; }

    private EmailAddress(string value) => Value = value;

    public static EmailAddress Parse(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);

        var trimmed = raw.Trim();
        // Cheap shape check — full RFC 5322 validation is out of scope for the domain layer.
        var atIndex = trimmed.IndexOf('@', StringComparison.Ordinal);
        if (atIndex <= 0 || atIndex == trimmed.Length - 1 ||
            !trimmed.AsSpan(atIndex + 1).Contains('.'))
        {
            throw new ArgumentException($"'{raw}' is not a valid email address.", nameof(raw));
        }

        return new EmailAddress(trimmed.ToLower(CultureInfo.InvariantCulture));
    }

    public static bool TryParse(string? raw, out EmailAddress email)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            email = default;
            return false;
        }

        try
        {
            email = Parse(raw);
            return true;
        }
        catch (ArgumentException)
        {
            email = default;
            return false;
        }
    }

    public override string ToString() => Value;
}
