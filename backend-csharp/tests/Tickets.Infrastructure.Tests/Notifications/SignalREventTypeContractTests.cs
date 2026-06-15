using Tickets.Infrastructure.Notifications;

namespace Tickets.Infrastructure.Tests.Notifications;

/// <summary>
/// Contract test pinning the SignalR <c>type</c> strings the iPad kiosk decodes.
/// The gateway normalizes the Application-layer device event NAME into the
/// canonical wire <c>type</c> before sending; these are the exact strings in
/// <c>contracts/signalr/server-to-device/*.json</c> (the single source of truth,
/// also decoded by <c>KioskApp/.../SignalRService.swift</c>). No Docker / network.
/// </summary>
public sealed class SignalREventTypeContractTests
{
    [Theory]
    // Application event name  ->  canonical iPad wire `type`.
    [InlineData("showFeedback", "SHOW_FEEDBACK")]   // show-feedback.json
    [InlineData("dismissDevice", "DISMISS")]        // dismiss.json
    [InlineData("changeMode", "MODE_CHANGED")]      // mode-changed.json
    public void ToWireDeviceType_MapsApplicationNameToCanonicalWireType(
        string applicationName, string wireType)
    {
        AzureSignalRNotificationGateway.ToWireDeviceType(applicationName)
            .Should().Be(wireType);
    }

    [Theory]
    // Already-canonical types pass through unchanged (no entry in the map).
    [InlineData("UNPAIRED")]   // unpaired.json
    [InlineData("PING")]       // ping.json
    [InlineData("LOCK_ASSIGNED")] // lock-assigned.json
    public void ToWireDeviceType_AlreadyCanonical_PassesThroughUnchanged(string type)
    {
        AzureSignalRNotificationGateway.ToWireDeviceType(type).Should().Be(type);
    }

    [Fact]
    public void DeviceTypeMap_PinsExactlyTheTranslatedNames()
    {
        // Guards against silent additions/removals to the translation table.
        AzureSignalRNotificationGateway.DeviceTypeMap.Should().BeEquivalentTo(
            new Dictionary<string, string>
            {
                ["showFeedback"] = "SHOW_FEEDBACK",
                ["dismissDevice"] = "DISMISS",
                ["changeMode"] = "MODE_CHANGED",
            });
    }

    [Fact]
    public void DashboardEventTypes_AreColonNamespacedLowercase()
    {
        // The dashboard listens for colon-namespaced lowercase event types
        // (frontend api.ts / hooks). These flow through NotifyDashboardAsync
        // verbatim (no translation table) — pin the spelling of the ones the
        // backend emits so a rename here can't drift from the SPA listeners.
        var dashboardTypes = new[]
        {
            "case:created", "case:updated",
            "device:paired", "device:unpaired", "device:renamed",
            "device:updated", "device:mode_changed",
            "device:online", "device:offline",
        };

        foreach (var type in dashboardTypes)
        {
            type.Should().MatchRegex("^[a-z]+:[a-z_]+$");
        }
    }
}
