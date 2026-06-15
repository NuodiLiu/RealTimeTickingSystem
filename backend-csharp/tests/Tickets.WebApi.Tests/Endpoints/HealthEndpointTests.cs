using System.Net;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class HealthEndpointTests(WebApiFactory factory)
{
    [Fact]
    public async Task Get_Health_Returns200()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.GetAsync(new Uri("/health", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"status\":\"ok\"");
    }
}
