namespace Tickets.WebApi.Identity;

/// <summary>
/// Validated identity claims extracted from an Entra <c>id_token</c> after a
/// successful authorization-code exchange.
/// </summary>
/// <param name="TenantId">Entra tenant id (<c>tid</c>).</param>
/// <param name="ObjectId">Stable user object id (<c>oid</c>).</param>
/// <param name="Email">Sign-in email (<c>preferred_username</c> or <c>email</c>); may be null.</param>
/// <param name="Name">Display name (<c>name</c>); may be null.</param>
public sealed record EntraIdentity(
    string TenantId,
    string ObjectId,
    string? Email,
    string? Name);

/// <summary>
/// Exchanges an Entra authorization <c>code</c> for tokens, validates the
/// returned <c>id_token</c> (issuer, audience = ClientId, signature via the
/// tenant JWKS) and projects the staff identity claims.
/// <para>
/// Behind an interface so <c>/auth/redirect</c> tests can fake the Entra round
/// trip without a live tenant.
/// </para>
/// </summary>
public interface IEntraCodeExchanger
{
    /// <summary>
    /// Redeems <paramref name="code"/> at the Entra token endpoint using the
    /// PKCE <paramref name="codeVerifier"/> and the same <paramref name="redirectUri"/>
    /// that was sent on the authorize request, then validates the id_token.
    /// </summary>
    Task<EntraIdentity> ExchangeAsync(
        string code,
        string codeVerifier,
        string redirectUri,
        CancellationToken cancellationToken);
}
