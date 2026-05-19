using System.Net;
using Tickets.Domain.Devices;

namespace Tickets.WebApi.Tests.Endpoints;

[Collection("webapi")]
public sealed class DeviceEndpointTests(WebApiFactory factory)
{
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
        var client = factory.CreateAuthenticatedClient(); // staff JWT, not Device
        var response = await client.PostAsync(
            new Uri("/device/heartbeat", UriKind.Relative), content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
