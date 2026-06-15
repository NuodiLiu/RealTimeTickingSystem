namespace Tickets.Application.Cases.Commands;

/// <summary>
/// Staff grabs the oldest queued case (FIFO). Mirrors the legacy
/// <c>POST /cases/take-next</c> retry semantics: up to <see cref="MaxAttempts"/>
/// retries when a concurrent peer beats us to the same case.
/// </summary>
public sealed record TakeNextCaseCommand(int MaxAttempts = 3);
