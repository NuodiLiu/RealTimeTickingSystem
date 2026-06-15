namespace Tickets.Application.Feedback.Commands;

/// <summary>
/// Staff requests feedback collection on a specific device for a specific
/// case (legacy <c>POST /feedback/send</c>). Multi-aggregate write: takes a
/// lock on the device, creates a feedback session, advances the case to
/// PendingFeedback.
/// </summary>
public sealed record SendFeedbackCommand(Guid CaseId, Guid DeviceId);
