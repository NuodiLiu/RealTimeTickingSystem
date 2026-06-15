using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.SignalR.Management;
using Tickets.Application.Abstractions;
using Tickets.Infrastructure.Notifications;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// SignalR client negotiate endpoint. Mapped OUTSIDE the
/// <c>/api/signalr/webhook</c> prefix so <c>WebhookSignatureMiddleware</c> does
/// not intercept it. Mints a per-user Azure SignalR access token + service URL.
/// <para>
/// Staff (App-JWT) negotiate as a <c>dashboard</c> user and join the
/// <c>dashboard</c> group; paired devices (Device scheme) negotiate as a
/// <c>device</c> user and join their own <c>device:{id}</c> group. Anonymous
/// callers are rejected with 401 by <c>.RequireAuthorization()</c>.
/// </para>
/// </summary>
public static class SignalRNegotiateEndpoints
{
    private const string NegotiatePolicy = "SignalRNegotiate";

    /// <summary>
    /// Authorization policy accepting the staff JWT bearer scheme, the device
    /// App-JWT bearer scheme, OR the legacy device-header scheme — negotiate
    /// serves both client kinds. The iPad presents its DEVICE App-JWT as Bearer,
    /// which authenticates under <see cref="DeviceAuthSchemeDefaults.JwtScheme"/>.
    /// </summary>
    public static void AddSignalRNegotiatePolicy(this AuthorizationOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.AddPolicy(NegotiatePolicy, policy => policy
            .AddAuthenticationSchemes(
                JwtBearerDefaults.AuthenticationScheme,
                DeviceAuthSchemeDefaults.JwtScheme,
                DeviceAuthSchemeDefaults.Scheme)
            .RequireAuthenticatedUser());
    }

    public static IEndpointRouteBuilder MapSignalRNegotiateEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        // NOTE: deliberately NOT under "/api/signalr/webhook" so the webhook
        // signature middleware leaves it alone.
        app.MapPost("/api/signalr/negotiate", async (
                ICurrentUser currentUser,
                ICurrentDevice currentDevice,
                [FromServices] AzureSignalRNotificationGateway? gateway,
                CancellationToken ct) =>
            {
                if (gateway is null)
                {
                    // No Azure:SignalR:ConnectionString configured -> the real
                    // gateway isn't registered (e.g. local dev / tests).
                    return Results.Problem(
                        statusCode: StatusCodes.Status503ServiceUnavailable,
                        title: "signalr_unavailable",
                        detail: "Azure SignalR is not configured.");
                }

                // SECURITY: classify by identity kind, DEVICE first (see
                // NegotiateRouting). A device App-JWT carries a `sub` (the device
                // id) too, but ICurrentUser returns null for a device principal,
                // and ICurrentDevice reads only the device_id claim — so a device
                // can never be routed into the staff `dashboard` group (which
                // would leak dashboard PII).
                if (!NegotiateRouting.TryClassify(
                        currentDevice.DeviceId,
                        currentUser.StaffId,
                        out var userId,
                        out var userType,
                        out var group))
                {
                    // Authenticated but neither a staff nor a device principal —
                    // should not happen given the policy, but fail closed.
                    return Results.Unauthorized();
                }

                // Persist group membership so fan-outs reach this user once it
                // connects. Swallows its own failures.
                await gateway.AddUserToGroupAsync(userId, group, ct).ConfigureAwait(false);

                var negotiation = await gateway
                    .NegotiateAsync(new NegotiationOptions { UserId = userId }, ct)
                    .ConfigureAwait(false);

                return Results.Ok(new
                {
                    url = negotiation.Url,
                    accessToken = negotiation.AccessToken,
                    user = new { id = userId, type = userType },
                });
            })
            .WithTags("SignalR")
            .RequireAuthorization(NegotiatePolicy);

        return app;
    }
}
