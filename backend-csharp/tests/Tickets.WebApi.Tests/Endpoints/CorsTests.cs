using System.Net;

namespace Tickets.WebApi.Tests.Endpoints;

/// <summary>
/// Verifies the CORS policy (#9) honors <c>Cors:AllowedOrigins</c> AND works with
/// <c>AllowCredentials()</c>: the response must echo the exact origin (never '*')
/// and set <c>Access-Control-Allow-Credentials: true</c>, otherwise the SPA's
/// cookie-bearing cross-origin calls (e.g. /auth/refresh) would be blocked by the
/// browser.
/// </summary>
[Collection("webapi")]
public sealed class CorsTests(WebApiFactory factory)
{
    private const string AllowedOrigin = "https://app.cors-test.example";

    private HttpClient CreateClientWithOrigin() =>
        factory
            .WithWebHostBuilder(b => b.UseSetting("Cors:AllowedOrigins:0", AllowedOrigin))
            .CreateClient();

    [Fact]
    public async Task Preflight_FromAllowedOrigin_EchoesOriginAndAllowsCredentials()
    {
        var client = CreateClientWithOrigin();

        var request = new HttpRequestMessage(HttpMethod.Options, new Uri("/health", UriKind.Relative));
        request.Headers.Add("Origin", AllowedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        // Exact origin echoed (NOT '*' — required with credentials).
        response.Headers.GetValues("Access-Control-Allow-Origin").Should().ContainSingle()
            .Which.Should().Be(AllowedOrigin);
        response.Headers.GetValues("Access-Control-Allow-Credentials").Should().ContainSingle()
            .Which.Should().Be("true");
    }

    [Fact]
    public async Task ActualRequest_FromDisallowedOrigin_HasNoAllowOriginHeader()
    {
        var client = CreateClientWithOrigin();

        var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/health", UriKind.Relative));
        request.Headers.Add("Origin", "https://evil.example");

        var response = await client.SendAsync(request);

        // Request still succeeds (CORS is a browser-enforced response concern),
        // but the disallowed origin gets NO allow-origin header.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.Contains("Access-Control-Allow-Origin").Should().BeFalse();
    }
}
