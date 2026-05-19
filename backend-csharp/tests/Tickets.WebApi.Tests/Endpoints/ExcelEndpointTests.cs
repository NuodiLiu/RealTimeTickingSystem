using System.Net;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class ExcelEndpointTests(WebApiFactory factory)
{
    [Fact]
    public async Task Preview_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.GetAsync(new Uri("/excel/preview", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Preview_Staff_Returns200WithBreakdown()
    {
        var client = factory.CreateAuthenticatedClient();
        var response = await client.GetAsync(new Uri("/excel/preview", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("totalRows");
        body.Should().Contain("statusBreakdown");
    }

    [Fact]
    public async Task CasesJson_Staff_Returns200_JsonArray()
    {
        var client = factory.CreateAuthenticatedClient();
        var response = await client.GetAsync(new Uri("/excel/cases/json", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
    }

    [Fact]
    public async Task CasesXlsx_Staff_ReturnsBinaryWithExcelContentType()
    {
        var client = factory.CreateAuthenticatedClient();
        var response = await client.GetAsync(new Uri("/excel/cases", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should()
            .Be("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        bytes.Should().NotBeEmpty();
        // xlsx is a ZIP, starts with "PK\x03\x04"
        bytes.Length.Should().BeGreaterThan(4);
        bytes[0].Should().Be((byte)'P');
        bytes[1].Should().Be((byte)'K');
    }

    [Fact]
    public async Task CasesXlsxAlias_SameOutput()
    {
        var client = factory.CreateAuthenticatedClient();
        var response = await client.GetAsync(new Uri("/excel/cases/xlsx", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should()
            .Be("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
}
