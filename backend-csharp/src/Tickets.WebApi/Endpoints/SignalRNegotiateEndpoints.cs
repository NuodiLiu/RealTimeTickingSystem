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
    /// Authorization policy accepting either the staff JWT bearer scheme or the
    /// device auth scheme — negotiate serves both client kinds.
    /// </summary>
    public static void AddSignalRNegotiatePolicy(this AuthorizationOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.AddPolicy(NegotiatePolicy, policy => policy
            .AddAuthenticationSchemes(
                JwtBearerDefaults.AuthenticationScheme,
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

                string userId;
                string userType;
                string group;

                if (currentUser.StaffId is { } staffId)
                {
                    userId = staffId.Value.ToString();
                    userType = "dashboard";
                    group = "dashboard";
                }
                else if (currentDevice.DeviceId is { } deviceId)
                {
                    userId = deviceId.Value.ToString();
                    userType = "device";
                    group = $"device:{deviceId.Value}";
                }
                else
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
