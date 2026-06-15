namespace Tickets.Application.Feedback.Commands;

/// <summary>
/// Customer submits their rating + optional comment via the iPad
/// (legacy <c>POST /feedback/submit</c>).
/// </summary>
public sealed record SubmitFeedbackCommand(
    Guid SessionId,
    int Rating,
    string? Comment);
