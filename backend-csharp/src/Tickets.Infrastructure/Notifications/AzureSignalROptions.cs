namespace Tickets.Infrastructure.Notifications;

/// <summary>
/// Bound from the <c>"Azure:SignalR"</c> configuration section. Holds the
/// connection string for the Azure SignalR Service (serverless mode). When the
/// connection string is empty, the composition root keeps the in-memory
/// <see cref="FakeNotificationGateway"/> instead of wiring the real service —
/// this keeps integration tests green without a live SignalR endpoint.
/// </summary>
public sealed class AzureSignalROptions
{
    public const string SectionName = "Azure:SignalR";

    /// <summary>
    /// Azure SignalR connection string. Also accepted via the
    /// <c>AZURE_SIGNALR_CONNECTION_STRING</c> environment variable (mapped in
    /// the composition root). Empty -> the fake gateway stays registered.
    /// </summary>
    public string ConnectionString { get; set; } = string.Empty;
}
