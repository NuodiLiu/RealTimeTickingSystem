using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Cases;

/// <summary>
/// Object Mother for <see cref="Case"/> tests (AGENTS.md §5.5).
/// </summary>
internal static class CaseTestData
{
    public static StudentName AName(string raw = "Liam") => StudentName.Parse(raw);
    public static Category ACategory(string raw = "Technical") => Category.Parse(raw);
    public static ZId AZId(string raw = "z1234567") => ZId.Parse(raw);
    public static IClock AClock() => new FakeClock();

    public static Case AQueuedCase(IClock? clock = null) =>
        Case.Queue(AName(), ACategory(), AZId(), createdByDeviceId: DeviceId.New(), clock ?? AClock());

    public static Case AnInProgressCase(out StaffId staffId, IClock? clock = null)
    {
        var c = clock ?? AClock();
        var theCase = AQueuedCase(c);
        staffId = StaffId.New();
        theCase.Take(staffId, c);
        return theCase;
    }

    public static Case APendingFeedbackCase(
        out StaffId staffId,
        out DeviceId deviceId,
        out KioskLockId lockId,
        out FeedbackSessionId sessionId,
        IClock? clock = null)
    {
        var c = clock ?? AClock();
        var theCase = AnInProgressCase(out staffId, c);
        deviceId = DeviceId.New();
        lockId = KioskLockId.New();
        sessionId = FeedbackSessionId.New();
        theCase.RequestFeedback(deviceId, lockId, sessionId, c);
        return theCase;
    }

    public static Case AResolvedCase(IClock? clock = null)
    {
        var c = clock ?? AClock();
        var theCase = AnInProgressCase(out _, c);
        theCase.ResolveDirectly(c);
        return theCase;
    }
}
