namespace Tickets.Domain.Devices;

/// <summary>
/// Human-readable label for a kiosk device. Trimmed, non-empty, max 64 chars.
/// <para>
/// The Node backend does not enforce length but stores arbitrary strings; the
/// 64-char cap is introduced here as a defensive default. Adjust by changing
/// <see cref="MaxLength"/> after consulting api-device.md known-pitfall #12.
/// </para>
/// </summary>
public readonly record struct DeviceName
{
    public const int MaxLength = 64;

    public string Value { get; }

    private DeviceName(string value) => Value = value;

    public static DeviceName Parse(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);

        var trimmed = raw.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new ArgumentException(
                $"Device name must be at most {MaxLength} characters; got {trimmed.Length}.",
                nameof(raw));
        }

        return new DeviceName(trimmed);
    }

    public override string ToString() => Value;
}
