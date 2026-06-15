using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Dtos;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Queries;
using Tickets.Application.Common;
using Tickets.Application.Common.Json;
using Tickets.Domain.Cases;
using Tickets.WebApi.Common;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Endpoints;

public static class CasesEndpoints
{
    public static IEndpointRouteBuilder MapCasesEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/cases").WithTags("Cases");

        // Public — display screens.
        group.MapGet("/public-queue", async (
            GetPublicQueueHandler handler,
            int? maxResults,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new GetPublicQueueQuery(maxResults ?? 50), ct)).ToHttpResult())
            .AllowAnonymous();

        // POST /cases — device authenticated. A6 hardening: was AllowAnonymous;
        // now requires the Device auth scheme. The originating device id is
        // bound from the authenticated principal (ICurrentDevice), NOT the
        // request body, so a device cannot spoof another device's id.
        group.MapPost("/", async (
            PostCaseHandler handler,
            ICurrentDevice currentDevice,
            PostCaseCommand command,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    command with { CreatedByDeviceId = currentDevice.DeviceId?.Value },
                    ct)).ToHttpResult(StatusCodes.Status201Created))
            .RequireAuthorization(DeviceAuthSchemeDefaults.Policy);

        // Staff-only. Accept either Pascal enum names (Queued, InProgress, …)
        // or legacy lowercase snake_case ("queued", "in_progress",
        // "resolved_pending_feedback", "resolved") for compatibility with the
        // existing frontend.
        group.MapGet("/", async (
            GetQueuedCasesHandler handler,
            string? status,
            int? page,
            int? pageSize,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new GetQueuedCasesQuery(
                        Status: ParseStatus(status),
                        Page: page ?? 1,
                        PageSize: pageSize ?? 50),
                    ct)).ToHttpResult())
            .RequireAuthorization();

        // take-next / take wrap the case in { case, message } so the dashboard
        // (useQueue.ts) can read result.case + result.message and refresh.
        group.MapPost("/take-next", async (
            TakeNextCaseHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new TakeNextCaseCommand(), ct))
                    .Map(c => new TakeCaseResponseDto(
                        c,
                        c is null ? "No cases in the queue." : "Case taken successfully."))
                    .ToHttpResult())
            .RequireAuthorization();

        group.MapPost("/{id:guid}/take", async (
            Guid id,
            TakeCaseHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new TakeCaseCommand(id), ct))
                    .Map(c => new TakeCaseResponseDto(c, "Case taken successfully."))
                    .ToHttpResult())
            .RequireAuthorization();

        // resolve / escalate wrap the case in { case } (frontend ResolveCaseRes).
        group.MapPost("/{id:guid}/resolve", async (
            Guid id,
            ResolveCaseHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new ResolveCaseCommand(id), ct))
                    .Map(c => new CaseEnvelopeDto(c!))
                    .ToHttpResult())
            .RequireAuthorization();

        group.MapPost("/{id:guid}/escalate", async (
            Guid id,
            EscalateCaseHandler handler,
            EscalateCaseCommand body,
            CancellationToken ct) =>
                (await handler.HandleAsync(body with { CaseId = id }, ct))
                    .Map(c => new CaseEnvelopeDto(c!))
                    .ToHttpResult())
            .RequireAuthorization();

        return app;
    }

    private static CaseStatus ParseStatus(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return CaseStatus.Queued;
        }

        var trimmed = raw.Trim();

        // The dashboard sends the legacy UPPER_SNAKE wire value lowercased
        // (CasesAPI.list → status.toLowerCase()), e.g.
        // "resolved_pending_feedback". Match those FIRST — a naive
        // underscore-stripped Enum.TryParse cannot map RESOLVED_PENDING_FEEDBACK
        // to PendingFeedback (the "resolved" prefix breaks the name match) and
        // would silently fall back to QUEUED.
        if (WireEnum.TryParseCaseStatus(trimmed.ToUpperInvariant(), out var wire))
        {
            return wire;
        }

        // Fallback: PascalCase enum name (e.g. "InProgress").
        var normalized = trimmed.Replace("_", string.Empty, StringComparison.Ordinal);
        if (Enum.TryParse<CaseStatus>(normalized, ignoreCase: true, out var parsed))
        {
            return parsed;
        }

        return CaseStatus.Queued;
    }
}
