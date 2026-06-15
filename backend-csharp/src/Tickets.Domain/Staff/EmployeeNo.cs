namespace Tickets.Domain.Staff;

/// <summary>
/// Auto-generated employee number. For Azure-AD-provisioned staff this follows the
/// pattern <c>aad-{tenantId}-{first8ofObjectId}</c> (matches Node behavior at
/// backend/src/services/staff.service.ts <c>generateEmployeeNumber</c>).
/// </summary>
public readonly record struct EmployeeNo
{
    public string Value { get; }

    private EmployeeNo(string value) => Value = value;

    public static EmployeeNo ForAzureAd(string tenantId, string objectId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);
        ArgumentException.ThrowIfNullOrWhiteSpace(objectId);
        if (objectId.Length < 8)
        {
            throw new ArgumentException("Azure AD objectId must have at least 8 characters.", nameof(objectId));
        }
        return new EmployeeNo($"aad-{tenantId}-{objectId[..8]}");
    }

    public static EmployeeNo FromRaw(string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(raw);
        return new EmployeeNo(raw);
    }

    public override string ToString() => Value;
}
