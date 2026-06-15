using System.Net;
using Tickets.Domain.Devices;

namespace Tickets.WebApi.Tests.Endpoints;

/// <summary>
/// Tests for <c>POST /api/signalr/negotiate</c>. These boot the full
/// WebApplicationFactory (Postgres container) so they need Docker → run in CI;
/// they compile locally without it.
/// <para>
/// The factory configures no <c>Azure:SignalR:ConnectionString</c>, so the real
/// gateway is not registered: an authenticated negotiate falls through to the
/// 503 "signalr_unavailable" branch. Anonymous callers are still rejected with
/// 401 by the negotiate authorization policy BEFORE that branch is reached, so
/// the auth wiring is exercised end-to-end without a live SignalR endpoint.
/// </para>
/// </summary>
[Collection("webapi")]
public sealed class SignalRNegotiateEndpointTests(WebApiFactory factory)
{
    private static readonly Uri NegotiateUri =
        new("/api/signalr/negotiate", UriKind.Relative);

    [Fact]
    public async Task Negotiate_Anonymous_Returns401()
    {
        var client = factory.CreateAnonymousClient();

        var response = await client.PostAsync(NegotiateUri, content: null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Negotiate_StaffJwt_PassesAuth_ThenSignalRUnavailable503()
    {
        var client = factory.CreateAuthenticatedClient();

        var response = await client.PostAsync(NegotiateUri, content: null);

        // Authorized (not 401), but the test host has no Azure SignalR
        // connection string, so the endpoint reports the gateway unavailable.
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task Negotiate_DeviceAuth_PassesAuth_ThenSignalRUnavailable503()
    {
        var (deviceId, secret) = await factory.SeedPairedDeviceAsync(name: "Kiosk-Neg");
        var client = factory.CreateDeviceAuthenticatedClient(deviceId, secret);

        var response = await client.PostAsync(NegotiateUri, content: null);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task Negotiate_DeviceAppJwtBearer_PassesAuth_ThenSignalRUnavailable503()
    {
        // The iPad presents its DEVICE App-JWT as Bearer (not the Device header).
        // It must authenticate at negotiate under the DeviceJwt bearer scheme.
        var client = factory.CreateDeviceJwtClient(DeviceId.New());

        var response = await client.PostAsync(NegotiateUri, content: null);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task Negotiate_BadDeviceCredentials_Returns401()
    {
        var client = factory.CreateDeviceAuthenticatedClient(DeviceId.New(), "wrong-secret");

        var response = await client.PostAsync(NegotiateUri, content: null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
