using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Tickets.WebApi.Identity;

/// <summary>
/// Production <see cref="IEntraCodeExchanger"/>: POSTs the authorization code to
/// the Entra token endpoint (confidential client + PKCE), then validates the
/// returned <c>id_token</c> against the tenant's published signing keys.
/// <para>
/// The OpenID metadata / JWKS document is fetched and cached by
/// <see cref="ConfigurationManager{T}"/> so signature validation does not hit
/// the network on every login.
/// </para>
/// </summary>
internal sealed class EntraCodeExchanger : IEntraCodeExchanger
{
    private readonly HttpClient _http;
    private readonly AzureAdOptions _opts;
    private readonly ILogger<EntraCodeExchanger> _logger;
    private readonly ConfigurationManager<OpenIdConnectConfiguration> _oidcConfig;

    public EntraCodeExchanger(
        HttpClient http,
        IOptions<AzureAdOptions> opts,
        ILogger<EntraCodeExchanger> logger)
    {
        ArgumentNullException.ThrowIfNull(opts);
        _http = http ?? throw new ArgumentNullException(nameof(http));
        _opts = opts.Value;
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _oidcConfig = new ConfigurationManager<OpenIdConnectConfiguration>(
            _opts.MetadataAddress,
            new OpenIdConnectConfigurationRetriever(),
            new HttpDocumentRetriever(_http) { RequireHttps = true });
    }

    public async Task<EntraIdentity> ExchangeAsync(
        string code,
        string codeVerifier,
        string redirectUri,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(redirectUri);

        var form = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["client_id"] = _opts.ClientId,
            ["client_secret"] = _opts.ClientSecret,
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = redirectUri,
            ["code_verifier"] = codeVerifier,
            ["scope"] = "openid profile email",
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, _opts.TokenEndpoint)
        {
            Content = new FormUrlEncodedContent(form),
        };

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            // Do NOT log the response body — it can echo the code/secret.
            _logger.LogWarning(
                "Entra token exchange failed with status {StatusCode}.",
                (int)response.StatusCode);
            throw new EntraExchangeException("Token exchange with Entra failed.");
        }

        var token = await response.Content
            .ReadFromJsonAsync<TokenResponse>(cancellationToken)
            .ConfigureAwait(false);

        if (token is null || string.IsNullOrWhiteSpace(token.IdToken))
        {
            throw new EntraExchangeException("Entra token response did not contain an id_token.");
        }

        var principal = await ValidateIdTokenAsync(token.IdToken, cancellationToken)
            .ConfigureAwait(false);

        var tid = principal.FindFirst("tid")?.Value;
        var oid = principal.FindFirst("oid")?.Value;
        if (string.IsNullOrWhiteSpace(tid) || string.IsNullOrWhiteSpace(oid))
        {
            throw new EntraExchangeException("id_token is missing required tid/oid claims.");
        }

        // Defense-in-depth tenant pinning: even if AzureAd:TenantId were ever
        // loosened to common/organizations (which would relax issuer validation),
        // only the configured tenant's users may provision staff.
        if (!string.Equals(tid, _opts.TenantId, StringComparison.OrdinalIgnoreCase))
        {
            throw new EntraExchangeException("id_token tenant does not match the configured tenant.");
        }

        var email = principal.FindFirst("preferred_username")?.Value
            ?? principal.FindFirst("email")?.Value;
        var name = principal.FindFirst("name")?.Value;

        return new EntraIdentity(tid, oid, email, name);
    }

    private async Task<System.Security.Claims.ClaimsPrincipal> ValidateIdTokenAsync(
        string idToken,
        CancellationToken cancellationToken)
    {
        var config = await _oidcConfig.GetConfigurationAsync(cancellationToken).ConfigureAwait(false);

        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = config.Issuer,
            ValidateAudience = true,
            ValidAudience = _opts.ClientId,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = config.SigningKeys,
            NameClaimType = "name",
        };

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        try
        {
            return handler.ValidateToken(idToken, parameters, out _);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(
                ex,
                "id_token validation failed: {Reason}.",
                ex.GetType().Name);
            throw new EntraExchangeException("id_token validation failed.", ex);
        }
    }

    private sealed class TokenResponse
    {
        [JsonPropertyName("id_token")]
        public string? IdToken { get; init; }

        [JsonPropertyName("access_token")]
        public string? AccessToken { get; init; }
    }
}

/// <summary>
/// Raised when the Entra code exchange or id_token validation fails. Carries no
/// secret material so it is safe to surface a generic message to the caller.
/// </summary>
public sealed class EntraExchangeException : Exception
{
    public EntraExchangeException()
    {
    }

    public EntraExchangeException(string message)
        : base(message)
    {
    }

    public EntraExchangeException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
