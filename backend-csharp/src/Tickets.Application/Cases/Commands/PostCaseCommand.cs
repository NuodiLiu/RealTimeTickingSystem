namespace Tickets.Application.Cases.Commands;

/// <summary>
/// Device-originated request to create a queued case. Raw input — the handler
/// + validator turn the strings into value objects.
/// </summary>
public sealed record PostCaseCommand(
    string StudentName,
    string Category,
    string? ZId,
    Guid? CreatedByDeviceId);
