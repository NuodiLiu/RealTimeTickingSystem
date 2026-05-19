using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Handlers;
using Tickets.WebApi.Common;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Endpoints;

public static class DeviceEndpoints
{
    public static IEndpointRouteBuilder MapDeviceEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/device").WithTags("Device");

        // Device-authenticated: POST /device/heartbeat
        group.MapPost("/heartbeat", async (
            RecordHeartbeatHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new RecordHeartbeatCommand(), ct)).ToHttpResult())
            .RequireAuthorization(policy =>
                policy.AddAuthenticationSchemes(DeviceAuthSchemeDefaults.Scheme)
                      .RequireAuthenticatedUser());

        // Staff-authenticated: PATCH /device/{id}/mode
        group.MapPatch("/{id:guid}/mode", async (
            Guid id,
            ChangeDeviceModeBody body,
            ChangeDeviceModeHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new ChangeDeviceModeCommand(id, body.Mode), ct)).ToHttpResult())
            .RequireAuthorization();

        return app;
    }

    /// <summary>Body shape for <c>PATCH /device/:id/mode</c>.</summary>
    public sealed record ChangeDeviceModeBody(string Mode);
}
