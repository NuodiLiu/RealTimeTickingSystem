using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.FeedbackSessions;

internal static class FeedbackSessionTestData
{
    public static readonly TimeSpan DefaultWindow = TimeSpan.FromMinutes(5);

    public static IClock AClock() => new FakeClock();

    public static FeedbackSession ACreatedSession(IClock? clock = null)
    {
        var c = clock ?? AClock();
        return FeedbackSession.Create(
            CaseId.New(),
            StaffId.New(),
            DeviceId.New(),
            expireAt: c.UtcNow + DefaultWindow,
            c);
    }

    public static FeedbackSession ADeliveredSession(IClock? clock = null)
    {
        var c = clock ?? AClock();
        var session = ACreatedSession(c);
        session.MarkDelivered(c);
        return session;
    }

    public static FeedbackSession ASubmittedSession(IClock? clock = null)
    {
        var c = clock ?? AClock();
        var session = ADeliveredSession(c);
        session.Submit(FeedbackRating.From(5), comment: null, c);
        return session;
    }

    public static FeedbackSession ACancelledSession(IClock? clock = null)
    {
        var c = clock ?? AClock();
        var session = ACreatedSession(c);
        session.Cancel(c);
        return session;
    }

    public static FeedbackSession AnOverriddenSession(IClock? clock = null)
    {
        var c = clock ?? AClock();
        var session = ACreatedSession(c);
        session.MarkOverridden(c);
        return session;
    }

    public static FeedbackSession AnExpiredSession(IClock? clock = null)
    {
        var c = clock as FakeClock ?? new FakeClock();
        var session = ACreatedSession(c);
        c.Advance(DefaultWindow + TimeSpan.FromSeconds(1));
        session.Expire(c);
        return session;
    }
}
