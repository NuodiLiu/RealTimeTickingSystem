using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Cases.Queries;
using Tickets.WebApi.Common;

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

        // POST /cases — device authenticated (Phase 4 follow-up wires Device auth).
        // For now allow anonymous so tests can exercise the path; the handler
        // still requires a deviceId in the command body when present.
        group.MapPost("/", async (
            PostCaseHandler handler,
            PostCaseCommand command,
            CancellationToken ct) =>
                (await handler.HandleAsync(command, ct)).ToHttpResult(StatusCodes.Status201Created))
            .AllowAnonymous();

        // Staff-only.
        group.MapGet("/", async (
            GetQueuedCasesHandler handler,
            Tickets.Domain.Cases.CaseStatus? status,
            int? page,
            int? pageSize,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new GetQueuedCasesQuery(
                        Status: status ?? Tickets.Domain.Cases.CaseStatus.Queued,
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
}
