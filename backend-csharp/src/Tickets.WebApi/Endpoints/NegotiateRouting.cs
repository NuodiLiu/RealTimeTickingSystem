using Tickets.Domain.Devices;
using Tickets.Domain.Staff;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// Pure, dependency-free classification of an authenticated negotiate caller
/// into its SignalR <c>userId</c> / <c>userType</c> / group. Extracted from the
/// negotiate endpoint so the device-first routing rule can be unit-tested
/// without booting the host (no Azure SignalR / Docker needed).
/// <para>
/// SECURITY: classification is DEVICE-FIRST. A device App-JWT carries a
/// <c>sub</c> (the device id) too, but <c>ICurrentUser</c> returns null for a
/// device principal — so a device can never be routed into the staff
/// <c>dashboard</c> group (which would leak dashboard PII over the wire).
/// </para>
/// </summary>
public static class NegotiateRouting
{
    /// <summary>userType for a paired-device caller (iPad kiosk).</summary>
    public const string DeviceUserType = "device";

    /// <summary>userType for a staff (dashboard) caller.</summary>
    public const string DashboardUserType = "dashboard";

    /// <summary>Group every dashboard joins; staff broadcasts fan out to it.</summary>
    public const string DashboardGroup = "dashboard";

    /// <summary>Per-device group name: <c>device:{deviceId}</c>.</summary>
    public static string DeviceGroup(DeviceId deviceId) => $"device:{deviceId.Value}";

    /// <summary>
    /// Classifies the caller. Returns <c>false</c> when the caller is neither a
    /// device nor a staff principal (authenticated but unroutable — fail closed).
    /// </summary>
    public static bool TryClassify(
        DeviceId? deviceId,
        StaffId? staffId,
        out string userId,
        out string userType,
        out string group)
    {
        // DEVICE FIRST — see class summary.
        if (deviceId is { } device)
        {
            userId = device.Value.ToString();
            userType = DeviceUserType;
            group = DeviceGroup(device);
            return true;
        }

        if (staffId is { } staff)
        {
            userId = staff.Value.ToString();
            userType = DashboardUserType;
            group = DashboardGroup;
            return true;
        }

        userId = string.Empty;
        userType = string.Empty;
        group = string.Empty;
        return false;
    }
}
