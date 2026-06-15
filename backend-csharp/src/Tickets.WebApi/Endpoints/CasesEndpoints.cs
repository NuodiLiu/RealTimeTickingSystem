using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Queries;
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

        group.MapPost("/take-next", async (
            TakeNextCaseHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new TakeNextCaseCommand(), ct)).ToHttpResult())
            .RequireAuthorization();

        group.MapPost("/{id:guid}/take", async (
            Guid id,
            TakeCaseHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new TakeCaseCommand(id), ct)).ToHttpResult())
            .RequireAuthorization();

        group.MapPost("/{id:guid}/resolve", async (
            Guid id,
            ResolveCaseHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new ResolveCaseCommand(id), ct)).ToHttpResult())
            .RequireAuthorization();

        group.MapPost("/{id:guid}/escalate", async (
            Guid id,
            EscalateCaseHandler handler,
            EscalateCaseCommand body,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    body with { CaseId = id }, ct)).ToHttpResult())
            .RequireAuthorization();

        return app;
    }

    private static CaseStatus ParseStatus(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return CaseStatus.Queued;
        }

        // Legacy lowercase / snake_case → enum.
        var normalized = raw.Trim().Replace("_", string.Empty, StringComparison.Ordinal);
        if (Enum.TryParse<CaseStatus>(normalized, ignoreCase: true, out var parsed))
        {
            return parsed;
        }

        return CaseStatus.Queued;
    }
}
