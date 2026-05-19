using Tickets.Application.Feedback.Commands;
using Tickets.Application.Feedback.Handlers;
using Tickets.WebApi.Common;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Endpoints;

public static class FeedbackEndpoints
{
    public static IEndpointRouteBuilder MapFeedbackEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/feedback").WithTags("Feedback");

        // Staff: POST /feedback/send
        group.MapPost("/send", async (
            SendFeedbackCommand body,
            SendFeedbackHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(body, ct)).ToHttpResult())
            .RequireAuthorization();

        // Staff: POST /feedback/override
        group.MapPost("/override", async (
            OverrideFeedbackCommand body,
            OverrideFeedbackHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(body, ct)).ToHttpResult())
            .RequireAuthorization();

        // Device: POST /feedback/submit
        group.MapPost("/submit", async (
            SubmitFeedbackCommand body,
            SubmitFeedbackHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(body, ct)).ToHttpResult())
            .RequireAuthorization(policy =>
                policy.AddAuthenticationSchemes(DeviceAuthSchemeDefaults.Scheme)
                      .RequireAuthenticatedUser());

        return app;
    }
}
