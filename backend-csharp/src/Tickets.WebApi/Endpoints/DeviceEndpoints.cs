using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Handlers;
using Tickets.Application.Devices.Queries;
using Tickets.Domain.Devices;
using Tickets.WebApi.Common;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Endpoints;

public static class DeviceEndpoints
{
    public static IEndpointRouteBuilder MapDeviceEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/device").WithTags("Device");

        // ───── Device-authenticated ─────────────────────────────────────

        // POST /device/token — the iPad exchanges its `Device id:secret` API key
        // for the DEVICE App-JWT it then presents as Bearer to
        // /api/signalr/negotiate. Returns { appJwt, expiresAt } (iOS
        // DeviceJWTResponse). The minted token has the device audience +
        // token_use=device, so it can negotiate SignalR but is rejected by the
        // staff JwtBearer validation on staff endpoints.
        group.MapPost("/token", async (
            IssueDeviceTokenHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new IssueDeviceTokenCommand(), ct)).ToHttpResult())
            .RequireAuthorization(DeviceAuthPolicy);

        group.MapPost("/heartbeat", async (
            RecordHeartbeatHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new RecordHeartbeatCommand(), ct)).ToHttpResult())
            .RequireAuthorization(DeviceAuthPolicy);

        group.MapGet("/status", async (
            GetDeviceStatusHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new GetDeviceStatusQuery(), ct)).ToHttpResult())
            .RequireAuthorization(DeviceAuthPolicy);

        // ───── No-auth ──────────────────────────────────────────────────
        group.MapGet("/pairing-status/{id:guid}", async (
            Guid id,
            CheckPairingStatusHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new CheckPairingStatusQuery(id), ct)).ToHttpResult())
            .AllowAnonymous();

        // ───── Staff-authenticated ──────────────────────────────────────
        group.MapGet("/", async (
            ListDevicesHandler handler,
            DeviceMode? mode,
            int? page,
            int? pageSize,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new ListDevicesQuery(mode, page ?? 1, pageSize ?? 50), ct)).ToHttpResult())
            .RequireAuthorization();

        group.MapPatch("/{id:guid}/mode", async (
            Guid id,
            ChangeDeviceModeBody body,
            ChangeDeviceModeHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new ChangeDeviceModeCommand(id, body.Mode), ct)).ToHttpResult())
            .RequireAuthorization();

        group.MapPatch("/{id:guid}/name", async (
            Guid id,
            UpdateDeviceNameBody body,
            UpdateDeviceNameHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new UpdateDeviceNameCommand(id, body.Name), ct)).ToHttpResult())
            .RequireAuthorization();

        group.MapDelete("/{id:guid}", async (
            Guid id,
            UnpairDeviceHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new UnpairDeviceCommand(id), ct)).ToHttpResult(StatusCodes.Status204NoContent))
            .RequireAuthorization();

        return app;
    }

    private static void DeviceAuthPolicy(Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder p)
    {
        p.AddAuthenticationSchemes(DeviceAuthSchemeDefaults.Scheme).RequireAuthenticatedUser();
    }

    public sealed record ChangeDeviceModeBody(string Mode);
    public sealed record UpdateDeviceNameBody(string Name);
}
