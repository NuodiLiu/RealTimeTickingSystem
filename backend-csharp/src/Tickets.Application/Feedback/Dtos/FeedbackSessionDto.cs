using Tickets.Domain.FeedbackSessions;

namespace Tickets.Application.Feedback.Dtos;

public sealed record FeedbackSessionDto(
    Guid Id,
    Guid CaseId,
    Guid DeviceId,
    Guid StaffId,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpireAt,
    DateTimeOffset? SubmittedAt,
    int? Rating,
    string? Comment)
{
    public static FeedbackSessionDto From(FeedbackSession session)
    {
        ArgumentNullException.ThrowIfNull(session);
        return new FeedbackSessionDto(
            Id: session.Id.Value,
            CaseId: session.CaseId.Value,
            DeviceId: session.DeviceId.Value,
            StaffId: session.StaffId.Value,
            Status: session.Status.ToString(),
            CreatedAt: session.CreatedAt,
            ExpireAt: session.ExpireAt,
            SubmittedAt: session.SubmittedAt,
            Rating: session.Rating?.Value,
            Comment: session.Comment?.Value);
    }
}
