using Tickets.Application.Auth.Handlers;
using Tickets.Application.Auth.Queries;
using Tickets.WebApi.Common;

namespace Tickets.WebApi.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/auth").WithTags("Auth");

        group.MapGet("/me", async (
            GetCurrentStaffHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new GetCurrentStaffQuery(), ct)).ToHttpResult())
            .RequireAuthorization();

        return app;
    }
}
