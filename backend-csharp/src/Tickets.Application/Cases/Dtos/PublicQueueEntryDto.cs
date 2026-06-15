using Tickets.Domain.Cases;

namespace Tickets.Application.Cases.Dtos;

/// <summary>
/// Minimal projection used by public display screens. Mirrors the legacy
/// Node response shape from <c>GET /cases/public-queue</c> (api-cases.md §2).
/// <see cref="Status"/> serializes to the legacy UPPER_SNAKE wire string via
/// the registered <see cref="Tickets.Application.Common.Json.CaseStatusJsonConverter"/>.
/// </summary>
public sealed record PublicQueueEntryDto(
    Guid Id,
    string StudentName,
    int Position,
    DateTimeOffset CreatedAt,
    CaseStatus Status);
