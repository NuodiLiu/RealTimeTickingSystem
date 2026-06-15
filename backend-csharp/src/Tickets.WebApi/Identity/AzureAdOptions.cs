namespace Tickets.WebApi.Identity;

/// <summary>
/// Bound from the <c>"AzureAd"</c> configuration section. Drives the
/// Microsoft Entra (Azure AD) authorization-code login handshake at
/// <c>/auth/login</c> → Entra → <c>/auth/redirect</c>.
/// <para>
/// <see cref="ClientSecret"/> is supplied at runtime via
/// <c>AzureAd__ClientSecret</c> (container-app secret <c>aad-client-secret</c>)
/// and must never be logged (AGENTS.md §7).
/// </para>
/// </summary>
public sealed class AzureAdOptions
{
    public const string SectionName = "AzureAd";

    /// <summary>Entra login host, e.g. <c>https://login.microsoftonline.com/</c>.</summary>
    public string Instance { get; set; } = "https://login.microsoftonline.com/";

    /// <summary>Directory (tenant) id.</summary>
    public string TenantId { get; set; } = string.Empty;

    /// <summary>Application (client) id. Also the expected id_token audience.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>Confidential-client secret. Runtime-only; never logged.</summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// Path Entra redirects back to after consent. The redirect_uri sent to
    /// Entra is <c>{request scheme+host}{CallbackPath}</c>.
    /// </summary>
    public string CallbackPath { get; set; } = "/auth/redirect";

    /// <summary>Trailing-slash-normalised authority, e.g. <c>{Instance}/{TenantId}/v2.0</c>.</summary>
    public string Authority =>
        $"{Instance.TrimEnd('/')}/{TenantId}/v2.0";

    /// <summary>OAuth 2.0 authorize endpoint for this tenant.</summary>
    public string AuthorizeEndpoint =>
        $"{Instance.TrimEnd('/')}/{TenantId}/oauth2/v2.0/authorize";

    /// <summary>OAuth 2.0 token endpoint for this tenant.</summary>
    public string TokenEndpoint =>
        $"{Instance.TrimEnd('/')}/{TenantId}/oauth2/v2.0/token";

    /// <summary>OpenID Connect metadata document for JWKS / issuer discovery.</summary>
    public string MetadataAddress =>
        $"{Instance.TrimEnd('/')}/{TenantId}/v2.0/.well-known/openid-configuration";
}
