namespace Tickets.Application.Feedback.Commands;

/// <summary>
/// Staff overrides a device's current active lock and replaces the case it was
/// holding with a new one (legacy <c>POST /feedback/override</c>). The
/// <see cref="ExpectedLockId"/> + <see cref="ExpectedLockVersion"/> form a
/// CAS token; if they don't match the device's current lock, the request is
/// rejected with <c>precondition_failed</c>.
/// </summary>
public sealed record OverrideFeedbackCommand(
    Guid DeviceId,
    Guid NewCaseId,
    Guid ExpectedLockId,
    uint ExpectedLockVersion);
