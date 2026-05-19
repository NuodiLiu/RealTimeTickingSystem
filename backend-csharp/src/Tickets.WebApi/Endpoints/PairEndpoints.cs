using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Handlers;
using Tickets.WebApi.Common;

namespace Tickets.WebApi.Endpoints;

public static class PairEndpoints
{
    public static IEndpointRouteBuilder MapPairEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/pair").WithTags("Pair");

        // Staff: POST /pair/generate-qr
        group.MapPost("/generate-qr", async (
            GenerateQrHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(new GenerateQrCommand(), ct)).ToHttpResult())
            .RequireAuthorization();

        // Anonymous: POST /pair/complete
        // The pairing token itself is the auth: the device has no API key yet.
        group.MapPost("/complete", async (
            CompletePairingCommand body,
            CompletePairingHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(body, ct)).ToHttpResult(StatusCodes.Status201Created))
            .AllowAnonymous();

        return app;
    }
}
