using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.WebApi.Endpoints;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Tests.Endpoints;

/// <summary>
/// Exercises the production Entra (Azure AD) login handshake with a FAKED
/// <see cref="IEntraCodeExchanger"/> so no live tenant is required. Uses the
/// Postgres-backed <see cref="WebApiFactory"/> so the real
/// <c>GetOrProvisionStaffHandler</c> runs end-to-end (compiles now, executes in
/// CI where Docker is available).
/// </summary>
[Collection("webapi")]
public sealed class AuthAzureAdEndpointTests(WebApiFactory factory)
{
    private const string FrontendUrl = "https://app.example.test";

    private static WebApplicationFactoryClientOptions NoRedirect => new()
    {
        AllowAutoRedirect = false,
    };

    private HttpClient CreateClient(IEntraCodeExchanger? exchanger = null) =>
        factory
            .WithWebHostBuilder(b =>
            {
                b.UseSetting("FRONTEND_URL", FrontendUrl);
                if (exchanger is not null)
                {
                    b.ConfigureServices(services =>
                        services.Replace(ServiceDescriptor.Singleton(exchanger)));
                }
            })
            .CreateClient(NoRedirect);

    // ── /auth/login ──────────────────────────────────────────────────────

    [Fact]
    public async Task Login_Returns302ToEntraAuthorizeUrlWithState()
    {
        var client = CreateClient();

        var response = await client.GetAsync(new Uri("/auth/login", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = response.Headers.Location!.ToString();
        location.Should().StartWith(
            "https://login.microsoftonline.com/5c731996-1ac5-461d-b8aa-1e42b03811e6/oauth2/v2.0/authorize");
        location.Should().Contain("client_id=6baa2f22-6573-47fd-b943-595a322bed29");
        location.Should().Contain("response_type=code");
        location.Should().Contain("code_challenge=");
        location.Should().Contain("code_challenge_method=S256");
        location.Should().Contain("state=");

        // Short-lived state cookie is set so /auth/redirect can validate later.
        response.Headers.GetValues("Set-Cookie")
            .Should().Contain(c => c.StartsWith(
                AuthAzureAdEndpoints.LoginStateCookieName, StringComparison.Ordinal));
    }

    // ── /auth/redirect ───────────────────────────────────────────────────

    // AGENTS.md §8.2: /auth/redirect failures must 302 to /login?error=<code>
    // (the frontend depends on this), never return raw JSON.
    [Fact]
    public async Task Redirect_MissingState_RedirectsToLoginError()
    {
        var client = CreateClient();

        var response = await client.GetAsync(
            new Uri("/auth/redirect?code=abc", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location!.ToString().Should().Contain("/login?error=invalid_request");
    }

    [Fact]
    public async Task Redirect_NoStateCookie_RedirectsToLoginError()
    {
        var client = CreateClient();

        // state present in query but no matching __Host-app_oauth cookie.
        var response = await client.GetAsync(
            new Uri("/auth/redirect?code=abc&state=zzz", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location!.ToString().Should().Contain("/login?error=invalid_state");
    }

    [Fact]
    public async Task Redirect_StateMismatch_RedirectsToLoginError()
    {
        var client = CreateClient();

        var login = await client.GetAsync(new Uri("/auth/login", UriKind.Relative));
        var stateCookie = ExtractCookie(login, AuthAzureAdEndpoints.LoginStateCookieName);

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            new Uri("/auth/redirect?code=abc&state=not-the-real-state", UriKind.Relative));
        request.Headers.Add("Cookie", stateCookie);

        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location!.ToString().Should().Contain("/login?error=state_mismatch");
    }

    [Fact]
    public async Task Redirect_ValidCallback_ProvisionsStaffAndSetsAppJwtAndRefreshCookie()
    {
        var oid = Guid.NewGuid().ToString();
        var tid = "5c731996-1ac5-461d-b8aa-1e42b03811e6";
        var email = $"entra-{Guid.NewGuid():N}@example.test";
        var fake = new FakeEntraCodeExchanger(
            new EntraIdentity(tid, oid, email, "Entra User"));

        var client = CreateClient(fake);

        // 1. /auth/login to obtain a real state + state cookie.
        var login = await client.GetAsync(new Uri("/auth/login", UriKind.Relative));
        var stateCookie = ExtractCookie(login, AuthAzureAdEndpoints.LoginStateCookieName);
        var state = QueryValue(login.Headers.Location!.ToString(), "state");

        // 2. /auth/redirect with the matching state + cookie.
        var request = new HttpRequestMessage(
            HttpMethod.Get,
            new Uri($"/auth/redirect?code=any-code&state={state}", UriKind.Relative));
        request.Headers.Add("Cookie", stateCookie);

        var response = await client.SendAsync(request);

        // Faked exchanger was called with the code and the PKCE verifier.
        fake.LastCode.Should().Be("any-code");
        fake.LastCodeVerifier.Should().NotBeNullOrEmpty();

        // Redirects back to the configured frontend with the access token.
        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = response.Headers.Location!.ToString();
        location.Should().StartWith(FrontendUrl);
        location.Should().Contain("access_token=");

        // Sets the App-JWT refresh cookie exactly like DevAuthEndpoints.
        var refreshCookie = ExtractCookie(response, AuthEndpoints.RefreshCookieName);
        refreshCookie.Should().NotBeNullOrEmpty();

        // GetOrProvisionStaffHandler ran with the parsed Entra claims —
        // verify by the persisted staff record's stable identity key.
        var expectedKey = IdentityKey.FromAzureAd(tid, oid);
        await using var ctx = NewDbContext();
        var emailVo = EmailAddress.Parse(email);
        var staff = await ctx.Staff
            .FirstOrDefaultAsync(s => s.Email == emailVo);
        staff.Should().NotBeNull();
        staff!.IdentityKey.Should().Be(expectedKey);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private static TicketsDbContext NewDbContext()
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__TicketsDb")!;
        var options = new DbContextOptionsBuilder<TicketsDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new TicketsDbContext(options);
    }

    private static string ExtractCookie(HttpResponseMessage response, string name)
    {
        var setCookie = response.Headers.GetValues("Set-Cookie")
            .First(c => c.StartsWith(name, StringComparison.Ordinal));
        // Keep only the name=value pair for echoing back as a Cookie header.
        return setCookie.Split(';', 2)[0];
    }

    private static string QueryValue(string url, string key)
    {
        var query = new Uri(url).Query.TrimStart('?');
        foreach (var pair in query.Split('&'))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && kv[0] == key)
            {
                return Uri.UnescapeDataString(kv[1]);
            }
        }

        throw new InvalidOperationException($"query key '{key}' not found in {url}");
    }

    private sealed class FakeEntraCodeExchanger(EntraIdentity identity) : IEntraCodeExchanger
    {
        public string? LastCode { get; private set; }

        public string? LastCodeVerifier { get; private set; }

        public Task<EntraIdentity> ExchangeAsync(
            string code,
            string codeVerifier,
            string redirectUri,
            CancellationToken cancellationToken)
        {
            LastCode = code;
            LastCodeVerifier = codeVerifier;
            return Task.FromResult(identity);
        }
    }
}
