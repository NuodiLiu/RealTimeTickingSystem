using System.Text.Json;
using Tickets.Application.Common.Json;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;

namespace Tickets.Application.Tests.Common;

/// <summary>
/// Contract test pinning the EXACT on-the-wire JSON strings the existing
/// frontend (frontend/) and iPad app (KioskApp/) send and decode. The C#
/// backend replaces the old Node backend and MUST conform to these spellings —
/// they are NOT the PascalCase default <c>Enum.ToString()</c> produces.
/// <para>
/// Ground truth (read directly from the clients + contracts/):
/// <list type="bullet">
///   <item>CaseStatus — frontend/src/app/lib/api.ts line 50
///   (<c>"QUEUED" | "IN_PROGRESS" | "RESOLVED_PENDING_FEEDBACK" | "RESOLVED"</c>),
///   KioskApp/.../DTOs.swift (<c>enum CaseStatus</c>).</item>
///   <item>DeviceMode — frontend useDevices.ts (<c>'FEEDBACK' | 'REGISTRATION'</c>),
///   KioskApp DTOs.swift (<c>enum DeviceMode</c>),
///   contracts/signalr/server-to-device/mode-changed.json.</item>
///   <item>DeviceStatus — frontend useDevices.ts
///   (<c>'OFFLINE' | 'IDLE' | 'BUSY'</c>), KioskApp DTOs.swift.</item>
/// </list>
/// </para>
/// </summary>
public sealed class WireEnumContractTests
{
    /// <summary>The exact JSON options the WebApi HTTP pipeline + SignalR hub use.</summary>
    private static JsonSerializerOptions WireOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        WireJson.AddWireEnumConverters(options);
        return options;
    }

    // ── CaseStatus ──────────────────────────────────────────────────────

    [Theory]
    [InlineData(CaseStatus.Queued, "QUEUED")]
    [InlineData(CaseStatus.InProgress, "IN_PROGRESS")]
    // NOT "PENDING_FEEDBACK": both clients spell it RESOLVED_PENDING_FEEDBACK.
    [InlineData(CaseStatus.PendingFeedback, "RESOLVED_PENDING_FEEDBACK")]
    [InlineData(CaseStatus.Resolved, "RESOLVED")]
    public void CaseStatus_SerializesToExactWireString(CaseStatus value, string wire)
    {
        JsonSerializer.Serialize(value, WireOptions()).Should().Be($"\"{wire}\"");
    }

    [Theory]
    [InlineData("QUEUED", CaseStatus.Queued)]
    [InlineData("IN_PROGRESS", CaseStatus.InProgress)]
    [InlineData("RESOLVED_PENDING_FEEDBACK", CaseStatus.PendingFeedback)]
    [InlineData("RESOLVED", CaseStatus.Resolved)]
    public void CaseStatus_DeserializesFromExactWireString(string wire, CaseStatus value)
    {
        JsonSerializer.Deserialize<CaseStatus>($"\"{wire}\"", WireOptions())
            .Should().Be(value);
    }

    [Fact]
    public void CaseStatus_AllValuesAreContractMapped()
    {
        // Forces this test to be updated if a new CaseStatus value is added.
        Enum.GetValues<CaseStatus>().Should().HaveCount(4);
        foreach (var value in Enum.GetValues<CaseStatus>())
        {
            WireEnum.ToWire(value).Should().MatchRegex("^[A-Z_]+$");
        }
    }

    // ── DeviceMode ──────────────────────────────────────────────────────

    [Theory]
    [InlineData(DeviceMode.Registration, "REGISTRATION")]
    [InlineData(DeviceMode.Feedback, "FEEDBACK")]
    public void DeviceMode_SerializesToExactWireString(DeviceMode value, string wire)
    {
        JsonSerializer.Serialize(value, WireOptions()).Should().Be($"\"{wire}\"");
    }

    [Theory]
    [InlineData("REGISTRATION", DeviceMode.Registration)]
    [InlineData("FEEDBACK", DeviceMode.Feedback)]
    public void DeviceMode_DeserializesFromExactWireString(string wire, DeviceMode value)
    {
        JsonSerializer.Deserialize<DeviceMode>($"\"{wire}\"", WireOptions())
            .Should().Be(value);
    }

    [Fact]
    public void DeviceMode_AllValuesAreContractMapped()
    {
        Enum.GetValues<DeviceMode>().Should().HaveCount(2);
        foreach (var value in Enum.GetValues<DeviceMode>())
        {
            WireEnum.ToWire(value).Should().MatchRegex("^[A-Z_]+$");
        }
    }

    // ── DeviceStatus (derived dashboard tile state) ─────────────────────

    [Theory]
    [InlineData(DeviceStatus.Offline, "OFFLINE")]
    [InlineData(DeviceStatus.Idle, "IDLE")]
    [InlineData(DeviceStatus.Busy, "BUSY")]
    public void DeviceStatus_SerializesToExactWireString(DeviceStatus value, string wire)
    {
        JsonSerializer.Serialize(value, WireOptions()).Should().Be($"\"{wire}\"");
    }

    [Fact]
    public void DeviceStatus_AllValuesAreContractMapped()
    {
        Enum.GetValues<DeviceStatus>().Should().HaveCount(3);
        foreach (var value in Enum.GetValues<DeviceStatus>())
        {
            WireEnum.ToWire(value).Should().MatchRegex("^[A-Z]+$");
        }
    }

    // ── Casing inside a real DTO-shaped object ──────────────────────────

    [Fact]
    public void EnumNestedInObject_EmitsUpperWireString_NotPascalCase()
    {
        // A device push payload like MODE_CHANGED carries { "mode": "FEEDBACK" }.
        var json = JsonSerializer.Serialize(new { mode = DeviceMode.Feedback }, WireOptions());
        json.Should().Be("{\"mode\":\"FEEDBACK\"}");
        json.Should().NotContain("Feedback"); // never the PascalCase default
    }

    [Fact]
    public void CaseStatusNestedInObject_EmitsUpperWireString()
    {
        var json = JsonSerializer.Serialize(
            new { status = CaseStatus.PendingFeedback }, WireOptions());
        json.Should().Be("{\"status\":\"RESOLVED_PENDING_FEEDBACK\"}");
    }
}
