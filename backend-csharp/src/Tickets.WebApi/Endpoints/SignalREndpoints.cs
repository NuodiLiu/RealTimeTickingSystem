using Tickets.Application.SignalR.Commands;
using Tickets.Application.SignalR.Handlers;
using Tickets.WebApi.Common;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// Receives Azure SignalR upstream webhook traffic. Signature validation is
/// applied by WebhookSignatureMiddleware on the <c>/api/signalr/webhook</c>
/// prefix BEFORE these handlers run.
/// </summary>
public static class SignalREndpoints
{
    public static IEndpointRouteBuilder MapSignalRWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/api/signalr/webhook").WithTags("SignalR");

        // Public liveness probe; Azure SignalR Service health check hits this.
        group.MapGet("/health", () => Results.Ok(new { status = "ok" }))
            .AllowAnonymous();

        // POST /api/signalr/webhook/connected?deviceId=<guid>
        group.MapPost("/connected", async (
            Guid deviceId,
            MarkDeviceConnectedHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new MarkDeviceConnectedCommand(deviceId), ct))
                    .ToHttpResult())
            .AllowAnonymous();

        group.MapPost("/disconnected", async (
            Guid deviceId,
            MarkDeviceDisconnectedHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new MarkDeviceDisconnectedCommand(deviceId), ct))
                    .ToHttpResult())
            .AllowAnonymous();

        // Upstream-message + abuse events are not actioned in Phase 4 — we
        // accept and acknowledge so Azure doesn't retry. Phase 5 may route
        // them into domain handlers.
        group.MapPost("/message", () => Results.Ok())
            .AllowAnonymous();
        group.MapPost("/abuse", () => Results.Ok())
            .AllowAnonymous();

        return app;
    }
}
