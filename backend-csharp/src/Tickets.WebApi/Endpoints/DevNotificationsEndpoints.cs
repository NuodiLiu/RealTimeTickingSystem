using Tickets.Infrastructure.Notifications;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// Dev-only endpoints that surface the in-memory <see cref="FakeNotificationGateway"/>
/// log so a developer can verify that handlers dispatched the expected SignalR
/// notifications without standing up the real Azure SignalR service.
/// Mapped only when <c>ASPNETCORE_ENVIRONMENT=Development</c>.
/// </summary>
public static class DevNotificationsEndpoints
{
    public static IEndpointRouteBuilder MapDevNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/dev/notifications").WithTags("Dev");

        // GET /dev/notifications — returns all observed fan-out calls in order.
        group.MapGet("/", (FakeNotificationGateway gateway) =>
        {
            var snapshot = gateway.Log
                .Select(e => new
                {
                    target = e.Target,
                    eventType = e.EventType,
                    payload = e.Payload,
                })
                .ToArray();
            return Results.Json(new { count = snapshot.Length, entries = snapshot });
        }).AllowAnonymous();

        // DELETE /dev/notifications — clears the log so the next interaction
        // starts from a clean slate.
        group.MapDelete("/", (FakeNotificationGateway gateway) =>
        {
            gateway.Reset();
            return Results.NoContent();
        }).AllowAnonymous();

        return app;
    }
}
