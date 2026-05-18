namespace Tickets.Domain.Devices;

/// <summary>
/// Opaque hash of the device's API secret. The domain treats it as a black-box
/// string — actual hashing (sha256 hex) happens in the Application layer when
/// the pairing flow generates a new secret.
/// <para>
/// A "cleared" hash is represented by <see cref="Empty"/>; used right after
/// <c>Unpair</c> to invalidate the old API key (matches Node behaviour at
/// backend/src/services/device.service.ts <c>unpair</c>).
/// </para>
/// </summary>
public readonly record struct SecretHash
{
    public string Value { get; }

    private SecretHash(string value) => Value = value;

    public static SecretHash Empty { get; } = new(string.Empty);

    public static SecretHash FromRaw(string hash)
    {
        ArgumentNullException.ThrowIfNull(hash);
        return new SecretHash(hash);
    }

    public bool IsCleared => string.IsNullOrEmpty(Value);

    public override string ToString() => IsCleared ? "<cleared>" : "<sha256>";
}
