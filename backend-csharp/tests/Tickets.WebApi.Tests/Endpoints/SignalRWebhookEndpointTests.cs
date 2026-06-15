using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class SignalRWebhookEndpointTests(WebApiFactory factory)
{
    private const string ConnectionId = "conn-test-0001";

    // Azure SignalR signs Hex(HMAC-SHA256(accessKey, connectionId)) — the signed
    // content is the CONNECTION ID, not the body.
    private static string Hmac(string connectionId, string accessKey)
    {
        var hash = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(accessKey),
            Encoding.UTF8.GetBytes(connectionId));
        return Convert.ToHexString(hash);
    }

    private async Task<HttpResponseMessage> PostSignedAsync(string path, string body)
    {
        var client = factory.CreateAnonymousClient();
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        content.Headers.TryAddWithoutValidation("X-ASRS-Connection-Id", ConnectionId);
        content.Headers.TryAddWithoutValidation(
            "X-ASRS-Signature", "sha256=" + Hmac(ConnectionId, WebApiFactory.WebhookAccessKey));
        return await client.PostAsync(new Uri(path, UriKind.Relative), content);
    }

    [Fact]
    public async Task Health_NoSignatureNeeded_Returns200()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.GetAsync(
            new Uri("/api/signalr/webhook/health", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Connected_NoSignature_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.PostAsync(
            new Uri($"/api/signalr/webhook/connected?deviceId={Guid.NewGuid()}", UriKind.Relative),
            new StringContent("{}", Encoding.UTF8, "application/json"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Connected_BadSignature_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var content = new StringContent("{}", Encoding.UTF8, "application/json");
        content.Headers.TryAddWithoutValidation("X-ASRS-Connection-Id", ConnectionId);
        // Right shape, wrong digest.
        content.Headers.TryAddWithoutValidation(
            "X-ASRS-Signature",
            "sha256=00000000000000000000000000000000000000000000000000000000DEADBEEF");
        var response = await client.PostAsync(
            new Uri($"/api/signalr/webhook/connected?deviceId={Guid.NewGuid()}", UriKind.Relative),
            content);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Connected_SignatureWithoutPrefix_AlsoAccepted()
    {
        // Azure's doc spec is Hex(HMAC(...)) with no prefix; the SDK adds
        // "sha256=". Accept both forms.
        var client = factory.CreateAnonymousClient();
        var content = new StringContent("{}", Encoding.UTF8, "application/json");
        content.Headers.TryAddWithoutValidation("X-ASRS-Connection-Id", ConnectionId);
        content.Headers.TryAddWithoutValidation(
            "X-ASRS-Signature", Hmac(ConnectionId, WebApiFactory.WebhookAccessKey));
        var response = await client.PostAsync(
            new Uri($"/api/signalr/webhook/connected?deviceId={Guid.NewGuid()}", UriKind.Relative),
            content);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Connected_MultipleCommaSeparatedSignatures_AcceptedIfAnyMatches()
    {
        var client = factory.CreateAnonymousClient();
        var content = new StringContent("{}", Encoding.UTF8, "application/json");
        content.Headers.TryAddWithoutValidation("X-ASRS-Connection-Id", ConnectionId);
        var good = "sha256=" + Hmac(ConnectionId, WebApiFactory.WebhookAccessKey);
        content.Headers.TryAddWithoutValidation(
            "X-ASRS-Signature", "sha256=deadbeefdeadbeefdeadbeefdeadbeef," + good);
        var response = await client.PostAsync(
            new Uri($"/api/signalr/webhook/connected?deviceId={Guid.NewGuid()}", UriKind.Relative),
            content);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Connected_ValidSignature_UnknownDevice_StillReturns200()
    {
        // Webhook is best-effort — unknown device id is acknowledged so Azure
        // does not retry indefinitely.
        var response = await PostSignedAsync(
            $"/api/signalr/webhook/connected?deviceId={Guid.NewGuid()}",
            body: "{}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Connected_ValidSignature_PairedDevice_Returns200()
    {
        var (deviceId, _) = await factory.SeedPairedDeviceAsync(name: "Kiosk-Webhook");
        var response = await PostSignedAsync(
            $"/api/signalr/webhook/connected?deviceId={deviceId.Value}",
            body: "{}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Disconnected_ValidSignature_Returns200()
    {
        var (deviceId, _) = await factory.SeedPairedDeviceAsync(name: "Kiosk-Disc");
        var response = await PostSignedAsync(
            $"/api/signalr/webhook/disconnected?deviceId={deviceId.Value}",
            body: "{}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Abuse_ValidSignature_Returns200()
    {
        var response = await PostSignedAsync(
            "/api/signalr/webhook/abuse",
            body: "{\"reason\":\"test\"}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
