namespace Tickets.Application.Cases.Dtos;

/// <summary>
/// Minimal projection used by public display screens. Mirrors the legacy
/// Node response shape from <c>GET /cases/public-queue</c> (api-cases.md §2).
/// </summary>
public sealed record PublicQueueEntryDto(
    Guid Id,
    string StudentName,
    int Position,
    DateTimeOffset CreatedAt,
    string Status);
