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
        // The frontend QRGeneratorModal POSTs { mode } (optionally deviceLabel);
        // the body is optional so a bare POST still works.
        group.MapPost("/generate-qr", async (
            GenerateQrRequest? body,
            GenerateQrHandler handler,
            CancellationToken ct) =>
                (await handler.HandleAsync(
                    new GenerateQrCommand(body?.Mode, body?.DeviceLabel), ct)).ToHttpResult())
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

    /// <summary>Optional body for <c>POST /pair/generate-qr</c> (frontend sends { mode }).</summary>
    public sealed record GenerateQrRequest(string? Mode, string? DeviceLabel);
}
