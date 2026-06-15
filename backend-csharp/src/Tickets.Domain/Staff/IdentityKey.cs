namespace Tickets.Domain.Staff;

/// <summary>
/// Stable, globally unique identifier for an Azure AD identity.
/// Format: <c>aad:{tenantId}:{objectId}</c> — mirrors the Node implementation
/// at backend/src/services/staff.service.ts (api-auth.md §2 step 4).
/// </summary>
public readonly record struct IdentityKey
{
    public string Value { get; }

    private IdentityKey(string value) => Value = value;

    public static IdentityKey FromAzureAd(string tenantId, string objectId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);
        ArgumentException.ThrowIfNullOrWhiteSpace(objectId);
        return new IdentityKey($"aad:{tenantId}:{objectId}");
    }

    /// <summary>Reconstructs an identity key from its serialized form (e.g. when loading from DB).</summary>
    public static IdentityKey FromRaw(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);
        if (!raw.StartsWith("aad:", StringComparison.Ordinal))
        {
            throw new ArgumentException($"Identity key must start with 'aad:'; got '{raw}'.", nameof(raw));
        }
        return new IdentityKey(raw);
    }

    public override string ToString() => Value;
}
