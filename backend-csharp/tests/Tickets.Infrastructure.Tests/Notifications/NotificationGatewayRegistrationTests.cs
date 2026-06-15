using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tickets.Application.Abstractions;
using Tickets.Infrastructure.Notifications;

namespace Tickets.Infrastructure.Tests.Notifications;

/// <summary>
/// Pure unit tests for the notification-gateway wiring in
/// <see cref="DependencyInjection.AddInfrastructure"/> — no Docker needed.
/// Confirms the real <see cref="AzureSignalRNotificationGateway"/> is bound only
/// when an Azure SignalR connection string is configured; otherwise the
/// in-memory <see cref="FakeNotificationGateway"/> stays wired.
/// </summary>
public sealed class NotificationGatewayRegistrationTests
{
    // A syntactically valid Azure SignalR connection string. No network call is
    // made when the gateway is constructed (the ServiceManager is built lazily
    // and the hub context is only created on first send), so this is safe to
    // resolve without a live endpoint.
    private const string FakeSignalRConnectionString =
        "Endpoint=https://example.service.signalr.net;" +
        "AccessKey=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=;Version=1.0;";

    private static ServiceProvider BuildProvider(
        IEnumerable<KeyValuePair<string, string?>> extraConfig)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new[]
            {
                // AddInfrastructure requires a TicketsDb connection string. The
                // DbContext is registered but never opened in these tests.
                new KeyValuePair<string, string?>(
                    "ConnectionStrings:TicketsDb",
                    "Host=localhost;Database=tickets;Username=t;Password=t"),
            }.Concat(extraConfig))
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(config);
        return services.BuildServiceProvider();
    }

    // The provider is disposed with `await using` because the Azure gateway is
    // IAsyncDisposable-only; synchronous Dispose() on such a singleton throws.

    [Fact]
    public async Task NoSignalRConnectionString_BindsFakeGateway()
    {
        await using var provider = BuildProvider(Array.Empty<KeyValuePair<string, string?>>());

        var gateway = provider.GetRequiredService<INotificationGateway>();

        gateway.Should().BeOfType<FakeNotificationGateway>();
    }

    [Fact]
    public async Task EmptySignalRConnectionString_BindsFakeGateway()
    {
        await using var provider = BuildProvider(new[]
        {
            new KeyValuePair<string, string?>("Azure:SignalR:ConnectionString", "   "),
        });

        var gateway = provider.GetRequiredService<INotificationGateway>();

        gateway.Should().BeOfType<FakeNotificationGateway>();
    }

    [Fact]
    public async Task SignalRConnectionStringPresent_BindsAzureGateway()
    {
        await using var provider = BuildProvider(new[]
        {
            new KeyValuePair<string, string?>(
                "Azure:SignalR:ConnectionString", FakeSignalRConnectionString),
        });

        var gateway = provider.GetRequiredService<INotificationGateway>();

        gateway.Should().BeOfType<AzureSignalRNotificationGateway>();
    }

    [Fact]
    public async Task SignalRConnectionStringViaEnvFallbackKey_BindsAzureGateway()
    {
        // The composition root also accepts the flat AZURE_SIGNALR_CONNECTION_STRING
        // key as a fallback when the structured section is empty.
        await using var provider = BuildProvider(new[]
        {
            new KeyValuePair<string, string?>(
                "AZURE_SIGNALR_CONNECTION_STRING", FakeSignalRConnectionString),
        });

        var gateway = provider.GetRequiredService<INotificationGateway>();

        gateway.Should().BeOfType<AzureSignalRNotificationGateway>();
    }

    [Fact]
    public async Task FakeGateway_IsAlwaysRegisteredAsConcreteSingleton()
    {
        await using var provider = BuildProvider(new[]
        {
            new KeyValuePair<string, string?>(
                "Azure:SignalR:ConnectionString", FakeSignalRConnectionString),
        });

        // Even when the Azure gateway is the INotificationGateway binding, the
        // concrete FakeNotificationGateway is still resolvable (dev endpoints +
        // infra tests new it up via DI).
        provider.GetRequiredService<FakeNotificationGateway>().Should().NotBeNull();
    }
}
