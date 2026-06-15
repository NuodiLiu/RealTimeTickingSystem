using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Auth.Commands;
using Tickets.Application.Auth.Handlers;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// Production staff login via Microsoft Entra (Azure AD) authorization-code flow
/// with PKCE. <c>/auth/login</c> redirects the browser to Entra; <c>/auth/redirect</c>
/// validates the callback, exchanges the code, provisions the local Staff record
/// and issues the App-JWT + <c>__Host-app_rf</c> refresh cookie exactly as
/// <see cref="DevAuthEndpoints"/> does. The session token stays the App-JWT —
/// Entra is only used for the login handshake.
/// </summary>
public static class AuthAzureAdEndpoints
{
    /// <summary>Short-lived HttpOnly cookie holding the OAuth state + PKCE verifier + returnUrl.</summary>
    public const string LoginStateCookieName = "__Host-app_oauth";

    /// <summary>Login handshakes older than this are rejected (replay / abandoned tab).</summary>
    private static readonly TimeSpan LoginStateTtl = TimeSpan.FromMinutes(10);

    public static IEndpointRouteBuilder MapAuthAzureAdEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/auth").WithTags("Auth");

        // GET /auth/login — build the Entra authorize URL (code flow + state +
        // PKCE), stash state/verifier/returnUrl in a short-lived __Host- cookie,
        // and 302 the browser to Entra.
        group.MapGet("/login", (
            HttpContext httpContext,
            IOptions<AzureAdOptions> azureOptions,
            IClock clock,
            string? returnUrl) =>
        {
            var opts = azureOptions.Value;

            var state = RandomToken();
            var codeVerifier = RandomToken();
            var codeChallenge = Pkce.Challenge(codeVerifier);
            var redirectUri = BuildRedirectUri(httpContext, opts.CallbackPath);

            var payload = new LoginState(state, codeVerifier, returnUrl, clock.UtcNow);
            WriteStateCookie(httpContext, payload);

            var authorizeUrl = QueryHelpers.AddQueryString(opts.AuthorizeEndpoint, new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["client_id"] = opts.ClientId,
                ["response_type"] = "code",
                ["redirect_uri"] = redirectUri,
                ["response_mode"] = "query",
                ["scope"] = "openid profile email",
                ["state"] = state,
                ["code_challenge"] = codeChallenge,
                ["code_challenge_method"] = "S256",
            });

            return Results.Redirect(authorizeUrl);
        }).AllowAnonymous();

        // GET /auth/redirect — Entra callback. Validate state, exchange code,
        // provision the staff record, issue App-JWT + refresh cookie, redirect
        // back to the frontend.
        group.MapGet("/redirect", async (
            HttpContext httpContext,
            IEntraCodeExchanger exchanger,
            GetOrProvisionStaffHandler provision,
            IAppJwtIssuer jwtIssuer,
            IRefreshHandleStore handleStore,
            IOptions<AppJwtOptions> appJwtOptions,
            IOptions<AzureAdOptions> azureOptions,
            IConfiguration configuration,
            IClock clock,
            string? code,
            string? state,
            string? error,
            CancellationToken ct) =>
        {
            // AGENTS.md §8.2: /auth/redirect failures must 302 back to the SPA's
            // /login?error=<code> screen (the frontend depends on this) — never
            // return raw JSON to a top-level browser navigation from Entra.
            var frontendBase = configuration["FRONTEND_URL"] ?? configuration["FrontendUrl"];
            var loginBase = string.IsNullOrWhiteSpace(frontendBase)
                ? string.Empty
                : frontendBase.TrimEnd('/');
            IResult LoginError(string code) =>
                Results.Redirect($"{loginBase}/login?error={Uri.EscapeDataString(code)}");

            if (!string.IsNullOrEmpty(error))
            {
                return LoginError("entra_error");
            }

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            {
                return LoginError("invalid_request");
            }

            var stored = ReadStateCookie(httpContext);
            // One-time cookie: clear it regardless of outcome.
            httpContext.Response.Cookies.Delete(LoginStateCookieName);

            if (stored is null)
            {
                return LoginError("invalid_state");
            }

            if (!FixedTimeEquals(stored.State, state))
            {
                return LoginError("state_mismatch");
            }

            if (clock.UtcNow - stored.IssuedAt > LoginStateTtl)
            {
                return LoginError("state_expired");
            }

            var redirectUri = BuildRedirectUri(httpContext, azureOptions.Value.CallbackPath);

            EntraIdentity identity;
            try
            {
                identity = await exchanger.ExchangeAsync(code, stored.CodeVerifier, redirectUri, ct)
                    .ConfigureAwait(false);
            }
            catch (EntraExchangeException)
            {
                return LoginError("auth_failed");
            }

            var result = await provision.HandleAsync(
                new GetOrProvisionStaffCommand(
                    TenantId: identity.TenantId,
                    ObjectId: identity.ObjectId,
                    Email: identity.Email,
                    DisplayName: identity.Name),
                ct).ConfigureAwait(false);

            if (!result.IsSuccess)
            {
                return LoginError(result.Error!.Code);
            }

            var staff = result.Value!;
            var staffId = new StaffId(staff.Id);
            var role = Enum.Parse<StaffRole>(staff.Role);

            var jwt = jwtIssuer.Issue(staffId, role);
            var refreshExpireAt = clock.UtcNow + appJwtOptions.Value.RefreshTtl;
            var refreshHandle = await handleStore.IssueAsync(staffId, refreshExpireAt, ct)
                .ConfigureAwait(false);

            // Mirror DevAuthEndpoints / AuthEndpoints cookie config so
            // /auth/refresh and /auth/logout work unchanged afterwards.
            httpContext.Response.Cookies.Append(
                AuthEndpoints.RefreshCookieName,
                refreshHandle,
                new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Path = "/",
                    Expires = refreshExpireAt,
                    IsEssential = true,
                });

            var target = BuildFrontendRedirect(frontendBase, stored.ReturnUrl, jwt);
            return Results.Redirect(target);
        }).AllowAnonymous();

        return app;
    }

    private static string BuildRedirectUri(HttpContext httpContext, string callbackPath)
    {
        var request = httpContext.Request;
        var path = callbackPath.StartsWith('/') ? callbackPath : "/" + callbackPath;
        return $"{request.Scheme}://{request.Host}{path}";
    }

    private static string BuildFrontendRedirect(
        string? frontendBase,
        string? returnUrl,
        AppJwt jwt)
    {
        // Prefer an explicit, validated returnUrl under the frontend origin;
        // otherwise fall back to the frontend base (or root if unset).
        var baseUrl = string.IsNullOrWhiteSpace(frontendBase) ? "/" : frontendBase;

        string target;
        if (!string.IsNullOrWhiteSpace(returnUrl)
            // Reject protocol-relative ("//host") and backslash tricks before
            // resolving, so a crafted returnUrl can't escape the frontend origin.
            && !returnUrl.StartsWith("//", StringComparison.Ordinal)
            && !returnUrl.Contains('\\', StringComparison.Ordinal)
            && Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri)
            && Uri.TryCreate(baseUri, returnUrl, out var combined)
            && combined.Host == baseUri.Host
            && combined.Scheme == baseUri.Scheme)
        {
            target = combined.ToString();
        }
        else
        {
            target = baseUrl;
        }

        // Hand the freshly minted access token to the SPA via the fragment so it
        // never lands in server logs / Referer headers.
        var fragment =
            $"access_token={Uri.EscapeDataString(jwt.Token)}" +
            $"&expires_at={Uri.EscapeDataString(jwt.ExpireAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture))}";

        return target.Contains('#', StringComparison.Ordinal)
            ? $"{target}&{fragment}"
            : $"{target}#{fragment}";
    }

    private static void WriteStateCookie(HttpContext httpContext, LoginState state)
    {
        var json = JsonSerializer.Serialize(state, LoginStateJson.Options);
        var encoded = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(json));
        httpContext.Response.Cookies.Append(
            LoginStateCookieName,
            encoded,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                // Cross-site top-level redirect from Entra returns here, so the
                // cookie must survive a same-document navigation back. Lax is
                // sufficient for a GET top-level navigation and is stricter than
                // None.
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = state.IssuedAt + LoginStateTtl,
                IsEssential = true,
            });
    }

    private static LoginState? ReadStateCookie(HttpContext httpContext)
    {
        if (!httpContext.Request.Cookies.TryGetValue(LoginStateCookieName, out var raw)
            || string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            var json = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(raw));
            return JsonSerializer.Deserialize<LoginState>(json, LoginStateJson.Options);
        }
        catch (FormatException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string RandomToken() =>
        WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static bool FixedTimeEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(a),
            Encoding.UTF8.GetBytes(b));

    private sealed record LoginState(
        string State,
        string CodeVerifier,
        string? ReturnUrl,
        DateTimeOffset IssuedAt);

    private static class LoginStateJson
    {
        public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    }

    private static class Pkce
    {
        public static string Challenge(string verifier)
        {
            var hash = SHA256.HashData(Encoding.ASCII.GetBytes(verifier));
            return WebEncoders.Base64UrlEncode(hash);
        }
    }
}
