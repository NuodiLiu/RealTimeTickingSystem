using Tickets.Application.Common.Json;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Devices.Dtos;

/// <summary>
/// Response for <c>POST /device/heartbeat</c>, shaped for the iPad's
/// <c>HeartbeatResponse</c> decoder (KioskApp HeartbeatManager.swift):
/// <c>{ success, status, deviceMode, timestamp, currentLock? }</c>.
/// <list type="bullet">
///   <item><c>status</c> — "IDLE" or "BUSY" (the iPad compares against the
///   literal string "BUSY").</item>
///   <item><c>deviceMode</c> — REGISTRATION / FEEDBACK via the wire-enum
///   converter.</item>
///   <item><c>timestamp</c> — ISO-8601 server time of the heartbeat.</item>
///   <item><c>currentLock</c> — present only when BUSY. The device aggregate
///   does not join the Case/Staff, so the iPad's optional currentLock stays
///   null here (its decoder treats currentLock as optional). FOLLOW-UP: a
///   read-model join would let us populate case.studentName for the BUSY log.</item>
/// </list>
/// </summary>
public sealed record HeartbeatResponseDto(
    bool Success,
    string Status,
    DeviceMode DeviceMode,
    DateTimeOffset Timestamp,
    HeartbeatLockDto? CurrentLock)
{
    public static HeartbeatResponseDto From(KioskDevice device, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(device);
        ArgumentNullException.ThrowIfNull(clock);
        return new HeartbeatResponseDto(
            Success: true,
            Status: device.IsBusy ? "BUSY" : "IDLE",
            DeviceMode: device.Mode,
            Timestamp: clock.UtcNow,
            CurrentLock: null);
    }
}

/// <summary>
/// iPad's nested heartbeat <c>currentLock</c> shape. Not populated today (the
/// device aggregate carries no Case/Staff join); reserved so the contract type
/// exists if a read-model is added later.
/// </summary>
public sealed record HeartbeatLockDto(
    Guid Id,
    string Status,
    Guid CaseId,
    string StaffName,
    DateTimeOffset LeaseExpireAt);
