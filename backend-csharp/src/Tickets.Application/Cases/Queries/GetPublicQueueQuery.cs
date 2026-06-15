namespace Tickets.Application.Cases.Queries;

/// <summary>
/// No-auth lookup that powers public display screens. Returns the queued
/// cases in FIFO order, capped at <see cref="MaxResults"/> entries to fix
/// api-cases.md pitfall #11 (no pagination in legacy Node).
/// </summary>
public sealed record GetPublicQueueQuery(int MaxResults = 50);
