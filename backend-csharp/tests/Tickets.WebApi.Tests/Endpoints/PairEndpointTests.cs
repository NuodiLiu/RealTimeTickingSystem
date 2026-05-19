using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tickets.Application.Pairing.Commands;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class PairEndpointTests(WebApiFactory factory)
{
    private static JsonSerializerOptions JsonOpts => new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task GenerateQr_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.PostAsync(
            new Uri("/pair/generate-qr", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateQr_Staff_Returns200WithToken()
    {
        var client = factory.CreateAuthenticatedClient();

        var response = await client.PostAsync(
            new Uri("/pair/generate-qr", UriKind.Relative), content: null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        // CompletePairingDto matches PairingTicketDto here: { pairingToken, expireAt }
        json.GetProperty("pairingToken").GetString().Should().NotBeNullOrEmpty();
        json.GetProperty("expireAt").GetDateTimeOffset().Should()
            .BeAfter(DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task Complete_WithFreshToken_Returns201AndApiKey()
    {
        // First issue a token via the real endpoint to ensure realistic flow.
        var staffClient = factory.CreateAuthenticatedClient();
        var qrResponse = await staffClient.PostAsync(
            new Uri("/pair/generate-qr", UriKind.Relative), content: null);
        qrResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var qrJson = await qrResponse.Content.ReadFromJsonAsync<JsonElement>();
        var pairingToken = qrJson.GetProperty("pairingToken").GetString()!;

        var anonClient = factory.CreateAnonymousClient();
        var body = new CompletePairingCommand(
            PairingToken: pairingToken,
            DeviceName: $"Kiosk-Pair-{Guid.NewGuid():N}".Substring(0, 16),
            Mode: "Feedback");

        var response = await anonClient.PostAsJsonAsync("/pair/complete", body, JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var resultJson = await response.Content.ReadFromJsonAsync<JsonElement>();
        resultJson.GetProperty("deviceId").GetGuid().Should().NotBeEmpty();
        resultJson.GetProperty("apiKey").GetString().Should().Contain(":");
        resultJson.GetProperty("wsToken").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Complete_ReplayToken_Returns401()
    {
        // Generate a fresh token, consume it, then try to reuse it.
        var staffClient = factory.CreateAuthenticatedClient();
        var qrResponse = await staffClient.PostAsync(
            new Uri("/pair/generate-qr", UriKind.Relative), content: null);
        var qrJson = await qrResponse.Content.ReadFromJsonAsync<JsonElement>();
        var pairingToken = qrJson.GetProperty("pairingToken").GetString()!;

        var anon = factory.CreateAnonymousClient();
        var nameSuffix = Guid.NewGuid().ToString("N")[..8];
        var body = new CompletePairingCommand(
            pairingToken, $"K1-{nameSuffix}", "Feedback");
        var first = await anon.PostAsJsonAsync("/pair/complete", body, JsonOpts);
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var replay = await anon.PostAsJsonAsync(
            "/pair/complete",
            body with { DeviceName = $"K2-{nameSuffix}" },
            JsonOpts);

        replay.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
