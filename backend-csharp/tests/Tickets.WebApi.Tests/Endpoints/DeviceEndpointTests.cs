using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tickets.Domain.Devices;
using Tickets.WebApi.Endpoints;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class DeviceEndpointTests(WebApiFactory factory)
{
    private static JsonSerializerOptions JsonOpts => new(JsonSerializerDefaults.Web);

    // ─── Heartbeat (device-auth) ────────────────────────────────────────

    [Fact]
    public async Task Heartbeat_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.PostAsync(
            new Uri("/device/heartbeat", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Heartbeat_BadDeviceCredentials_Returns401()
    {
        var fakeId = DeviceId.New();
        var client = factory.CreateDeviceAuthenticatedClient(fakeId, "wrong-secret");
        var response = await client.PostAsync(
            new Uri("/device/heartbeat", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Heartbeat_ValidDevice_Returns200()
    {
        var (deviceId, secret) = await factory.SeedPairedDeviceAsync(name: "Kiosk-HB");
        var client = factory.CreateDeviceAuthenticatedClient(deviceId, secret);
        var response = await client.PostAsync(
            new Uri("/device/heartbeat", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Heartbeat_StaffJwtNotDeviceScheme_Returns401()
    {
        var client = factory.CreateAuthenticatedClient();
        var response = await client.PostAsync(
            new Uri("/device/heartbeat", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ─── Token exchange (device-auth -> device App-JWT) ─────────────────

    [Fact]
    public async Task Token_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.PostAsync(
            new Uri("/device/token", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_StaffJwtNotDeviceScheme_Returns401()
    {
        // A staff App-JWT must NOT mint a device token (device-header scheme only).
        var client = factory.CreateAuthenticatedClient();
        var response = await client.PostAsync(
            new Uri("/device/token", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_ValidDevice_ReturnsAppJwtAndExpiresAt()
    {
        var (deviceId, secret) = await factory.SeedPairedDeviceAsync(name: "Kiosk-TOK");
        var client = factory.CreateDeviceAuthenticatedClient(deviceId, secret);

        var response = await client.PostAsync(
            new Uri("/device/token", UriKind.Relative), content: null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        // iOS DeviceJWTResponse: { appJwt, expiresAt }.
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("appJwt").GetString().Should().NotBeNullOrEmpty();
        json.TryGetProperty("expiresAt", out _).Should().BeTrue();
    }

    // ─── SECURITY: device App-JWT is rejected on staff endpoints ────────

    [Fact]
    public async Task List_DeviceAppJwtBearer_RejectedOnStaffEndpoint()
    {
        // A device App-JWT (audience tickets-device, no role) must NOT pass the
        // staff JwtBearer validation on a staff endpoint — privilege escalation.
        var client = factory.CreateDeviceJwtClient(DeviceId.New());
        var response = await client.GetAsync(new Uri("/device", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ─── Pairing status (no-auth) ───────────────────────────────────────

    [Fact]
    public async Task PairingStatus_PairedDevice_ReturnsTrue()
    {
        var (deviceId, _) = await factory.SeedPairedDeviceAsync(name: "Kiosk-PS");
        var client = factory.CreateAnonymousClient();

        var response = await client.GetAsync(
            new Uri($"/device/pairing-status/{deviceId.Value}", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("isPaired").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task PairingStatus_UnknownId_ReturnsFalse()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.GetAsync(
            new Uri($"/device/pairing-status/{Guid.NewGuid()}", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("isPaired").GetBoolean().Should().BeFalse();
    }

    // ─── List (staff) ──────────────────────────────────────────────────

    [Fact]
    public async Task List_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.GetAsync(new Uri("/device", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task List_Staff_Returns200()
    {
        await factory.SeedPairedDeviceAsync(name: "Kiosk-LIST-1");
        var client = factory.CreateAuthenticatedClient();
        var response = await client.GetAsync(new Uri("/device", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        // B5: GET /device returns the dashboard shape { items: [...] } with
        // deviceId / isOnline (not a bare array, not id / isConnected).
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var items = body.GetProperty("items");
        items.GetArrayLength().Should().BeGreaterThan(0);
        var first = items[0];
        first.GetProperty("deviceId").GetString().Should().NotBeNullOrEmpty();
        first.TryGetProperty("isOnline", out _).Should().BeTrue();
        first.TryGetProperty("status", out _).Should().BeTrue();
        first.TryGetProperty("id", out _).Should().BeFalse();
        first.TryGetProperty("isConnected", out _).Should().BeFalse();
    }

    // ─── Rename + Unpair (staff) ───────────────────────────────────────

    [Fact]
    public async Task UpdateName_Staff_Returns200WithNewName()
    {
        var (deviceId, _) = await factory.SeedPairedDeviceAsync(name: "Kiosk-Old");
        var client = factory.CreateAuthenticatedClient();
        var body = new DeviceEndpoints.UpdateDeviceNameBody("Kiosk-Renamed");

        var response = await client.PatchAsJsonAsync(
            $"/device/{deviceId.Value}/name", body, JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        // Frontend UpdateDeviceNameRes: { success, device: { id, name, mode,
        // lastSeenAt } } — name is nested under "device".
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("success").GetBoolean().Should().BeTrue();
        json.GetProperty("device").GetProperty("name").GetString().Should().Be("Kiosk-Renamed");
    }

    [Fact]
    public async Task Unpair_Staff_IdleDevice_Returns204()
    {
        var (deviceId, _) = await factory.SeedPairedDeviceAsync(name: "Kiosk-Bye");
        var client = factory.CreateAuthenticatedClient();

        var response = await client.DeleteAsync(
            new Uri($"/device/{deviceId.Value}", UriKind.Relative));

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Unpair_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();
        var response = await client.DeleteAsync(
            new Uri($"/device/{Guid.NewGuid()}", UriKind.Relative));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
