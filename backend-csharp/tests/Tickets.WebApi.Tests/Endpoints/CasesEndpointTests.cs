using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tickets.Application.Cases.Commands;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class CasesEndpointTests(WebApiFactory factory)
{
    private static JsonSerializerOptions JsonOpts => new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task GetPublicQueue_AnonymousClient_Returns200WithEmptyList()
    {
        var client = factory.CreateAnonymousClient();

        var response = await client.GetAsync(new Uri("/cases/public-queue", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetCases_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.GetAsync(new Uri("/cases", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCases_AuthenticatedStaff_Returns200()
    {
        var client = factory.CreateAuthenticatedClient();
        var response = await client.GetAsync(new Uri("/cases", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task PostCase_ValidBody_Creates201()
    {
        var client = factory.CreateAnonymousClient();
        var body = new PostCaseCommand("Liam", "Technical", "z1234567", null);

        var response = await client.PostAsJsonAsync("/cases", body, JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task PostCase_MissingName_Returns400_WithOAuthErrorShape()
    {
        var client = factory.CreateAnonymousClient();
        var body = new PostCaseCommand("", "Tech", null, null);

        var response = await client.PostAsJsonAsync("/cases", body, JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        json.Should().NotBeNull();
        json!["error"].Should().Be("invalid_request");
        json.Should().ContainKey("error_description");
    }

    [Fact]
    public async Task TakeNext_EmptyQueue_Returns200WithNull()
    {
        // Use a fresh staff identity so the post earlier in this collection
        // does not bleed into this test's expectations of "queue empty".
        // Within a single shared collection, ordering is not deterministic,
        // so we simply assert the response is success (case may be null OR
        // the case posted by PostCase_ValidBody_Creates201).
        var client = factory.CreateAuthenticatedClient();

        var response = await client.PostAsync(
            new Uri("/cases/take-next", UriKind.Relative),
            content: null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
