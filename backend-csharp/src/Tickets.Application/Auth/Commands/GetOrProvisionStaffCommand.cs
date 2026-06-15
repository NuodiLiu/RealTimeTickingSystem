namespace Tickets.Application.Auth.Commands;

/// <summary>
/// Carries the Azure-AD claims extracted by the WebApi OAuth callback. Used
/// by the <c>/auth/redirect</c> flow to lazily create or update the local
/// Staff record (see api-auth.md §2 step 4).
/// </summary>
public sealed record GetOrProvisionStaffCommand(
    string TenantId,
    string ObjectId,
    string? Email,
    string? DisplayName);
