using Tickets.Domain.Devices;
using Tickets.Domain.Staff;
using Tickets.WebApi.Endpoints;

namespace Tickets.WebApi.Tests.Endpoints;

/// <summary>
/// Pure unit tests for SignalR negotiate routing (task 3). No host / Docker:
/// these exercise the classification rule the negotiate endpoint applies to
/// decide a caller's userType + group.
/// <list type="bullet">
///   <item>staff principal -> userType <c>dashboard</c>, group <c>dashboard</c></item>
///   <item>device principal -> userType <c>device</c>, group <c>device:{id}</c></item>
/// </list>
/// </summary>
public sealed class NegotiateRoutingTests
{
    [Fact]
    public void StaffPrincipal_RoutesToDashboardUserTypeAndGroup()
    {
        var staffId = StaffId.New();

        var ok = NegotiateRouting.TryClassify(
            deviceId: null,
            staffId: staffId,
            out var userId,
            out var userType,
            out var group);

        ok.Should().BeTrue();
        userType.Should().Be("dashboard");
        group.Should().Be("dashboard");
        userId.Should().Be(staffId.Value.ToString());
    }

    [Fact]
    public void DevicePrincipal_RoutesToDeviceUserTypeAndOwnGroup()
    {
        var deviceId = DeviceId.New();

        var ok = NegotiateRouting.TryClassify(
            deviceId: deviceId,
            staffId: null,
            out var userId,
            out var userType,
            out var group);

        ok.Should().BeTrue();
        userType.Should().Be("device");
        group.Should().Be($"device:{deviceId.Value}");
        userId.Should().Be(deviceId.Value.ToString());
    }

    [Fact]
    public void DeviceAndStaffBothPresent_DeviceWins_NeverLeaksIntoDashboardGroup()
    {
        // SECURITY: a device App-JWT can carry a `sub` that resolves as a staff
        // id; the device classification MUST take precedence so the device is
        // never routed into the dashboard group (PII leak).
        var deviceId = DeviceId.New();
        var staffId = StaffId.New();

        var ok = NegotiateRouting.TryClassify(
            deviceId: deviceId,
            staffId: staffId,
            out _,
            out var userType,
            out var group);

        ok.Should().BeTrue();
        userType.Should().Be("device");
        group.Should().Be($"device:{deviceId.Value}");
        group.Should().NotBe("dashboard");
    }

    [Fact]
    public void NeitherPrincipal_FailsClosed()
    {
        var ok = NegotiateRouting.TryClassify(
            deviceId: null,
            staffId: null,
            out var userId,
            out var userType,
            out var group);

        ok.Should().BeFalse();
        userId.Should().BeEmpty();
        userType.Should().BeEmpty();
        group.Should().BeEmpty();
    }
}
