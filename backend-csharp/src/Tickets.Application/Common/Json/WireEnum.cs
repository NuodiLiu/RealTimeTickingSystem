using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Application.Common.Json;

/// <summary>
/// Single source of truth for the legacy UPPER_SNAKE wire strings the existing
/// frontend (frontend/) and iPad app (KioskApp/) send and decode. The C#
/// backend replaces the old Node backend and MUST conform to these spellings —
/// they are NOT the PascalCase default <c>Enum.ToString()</c> produces.
/// <para>
/// Mappings were read directly from the clients and the SignalR contracts:
/// <list type="bullet">
///   <item>CaseStatus — frontend/src/app/lib/api.ts (<c>CaseStatus</c>),
///   frontend useQueue.ts (status switch), KioskApp DTOs.swift
///   (<c>enum CaseStatus</c>).</item>
///   <item>DeviceMode — frontend api.ts / useDevices.ts, KioskApp DTOs.swift
///   (<c>enum DeviceMode</c>), contracts/signalr/.../mode-changed.json.</item>
///   <item>DeviceStatus — frontend useDevices.ts (<c>'OFFLINE' | 'IDLE' |
///   'BUSY'</c>), KioskApp DTOs.swift (<c>enum DeviceStatus</c>).</item>
/// </list>
/// </para>
/// </summary>
public static class WireEnum
{
    // ── CaseStatus ──────────────────────────────────────────────────────
    public static string ToWire(CaseStatus value) => value switch
    {
        CaseStatus.Queued => "QUEUED",
        CaseStatus.InProgress => "IN_PROGRESS",
        // Legacy name: the "pending feedback" state is spelled
        // RESOLVED_PENDING_FEEDBACK by both clients — NOT PENDING_FEEDBACK.
        CaseStatus.PendingFeedback => "RESOLVED_PENDING_FEEDBACK",
        CaseStatus.Resolved => "RESOLVED",
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown CaseStatus."),
    };

    public static bool TryParseCaseStatus(string? wire, out CaseStatus value)
    {
        switch (wire)
        {
            case "QUEUED": value = CaseStatus.Queued; return true;
            case "IN_PROGRESS": value = CaseStatus.InProgress; return true;
            case "RESOLVED_PENDING_FEEDBACK": value = CaseStatus.PendingFeedback; return true;
            case "RESOLVED": value = CaseStatus.Resolved; return true;
            default: value = default; return false;
        }
    }

    // ── DeviceMode ──────────────────────────────────────────────────────
    public static string ToWire(DeviceMode value) => value switch
    {
        DeviceMode.Registration => "REGISTRATION",
        DeviceMode.Feedback => "FEEDBACK",
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown DeviceMode."),
    };

    public static bool TryParseDeviceMode(string? wire, out DeviceMode value)
    {
        switch (wire)
        {
            case "REGISTRATION": value = DeviceMode.Registration; return true;
            case "FEEDBACK": value = DeviceMode.Feedback; return true;
            default: value = default; return false;
        }
    }

    // ── DeviceStatus ────────────────────────────────────────────────────
    // Derived (not a domain enum): the dashboard's OFFLINE / IDLE / BUSY tile
    // state. Priority OFFLINE > BUSY > IDLE (frontend useDevices.ts).
    public static string ToWire(DeviceStatus value) => value switch
    {
        DeviceStatus.Offline => "OFFLINE",
        DeviceStatus.Idle => "IDLE",
        DeviceStatus.Busy => "BUSY",
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown DeviceStatus."),
    };

    // ── FeedbackSessionStatus ───────────────────────────────────────────
    // Not currently emitted over the wire by any client decoder, but exposed
    // here for completeness so future feedback DTOs stay consistent.
    public static string ToWire(FeedbackSessionStatus value) => value switch
    {
        FeedbackSessionStatus.Created => "CREATED",
        FeedbackSessionStatus.Delivered => "DELIVERED",
        FeedbackSessionStatus.Submitted => "SUBMITTED",
        FeedbackSessionStatus.Cancelled => "CANCELLED",
        FeedbackSessionStatus.Overridden => "OVERRIDDEN",
        FeedbackSessionStatus.Expired => "EXPIRED",
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown FeedbackSessionStatus."),
    };
}

/// <summary>
/// The derived per-device tile state the dashboard renders. There is no domain
/// enum for this — it is computed from connectivity + lock state at the
/// Application boundary (see <c>ListDevicesHandler</c> / <c>DeviceDto</c>).
/// </summary>
public enum DeviceStatus
{
    Offline,
    Idle,
    Busy,
}
