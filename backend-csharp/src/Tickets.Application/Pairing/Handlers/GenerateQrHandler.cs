using System.Text.Json;
using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Dtos;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Pairing.Handlers;

/// <summary>
/// Mints a pairing token, persists it with a 5-minute TTL, and returns the
/// scannable QR payload staff displays. Replaces the legacy
/// <c>POST /pair/generate-qr</c> (api-pair.md §1).
/// <para>
/// CONTRACT (B4): the response is <c>{ qrUrl, pairingToken, sessionId,
/// expiresAt }</c>. <see cref="PairingTicketDto.QrUrl"/> is a
/// <c>{base}/pair?data={urlencoded JSON}</c> string whose <c>data</c> param
/// carries <c>{ "pairingToken": "...", "apiEndpoint": "..." }</c> — the exact
/// shape the iPad's <c>PairingViewModel.extractPairingData</c> parses, and the
/// frontend <c>QRGeneratorModal</c> renders verbatim into the QR image.
/// </para>
/// </summary>
public sealed class GenerateQrHandler(
    IPairingTokenGenerator tokenGenerator,
    IPairingTokenStore tokenStore,
    IClock clock,
    ICurrentUser currentUser,
    IOptions<PairingQrOptions> qrOptions)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions QrJson =
        new(JsonSerializerDefaults.Web);

    public async Task<Result<PairingTicketDto>> HandleAsync(
        GenerateQrCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is null)
        {
            return Result<PairingTicketDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var token = tokenGenerator.Generate();
        var expireAt = clock.UtcNow + Ttl;

        await tokenStore.SaveAsync(token, expireAt, cancellationToken).ConfigureAwait(false);

        var qrUrl = BuildQrUrl(token, qrOptions.Value);

        // sessionId carries no server state today; the token IS the session.
        // The frontend type declares it, so we surface the token as the session
        // id to keep the shape stable without inventing a second identifier.
        return Result<PairingTicketDto>.Success(
            new PairingTicketDto(qrUrl, token, token, expireAt));
    }

    private static string BuildQrUrl(string token, PairingQrOptions opts)
    {
        var apiEndpoint = (opts.ApiEndpoint ?? string.Empty).Trim();
        var qrBase = string.IsNullOrWhiteSpace(opts.QrBaseUrl)
            ? apiEndpoint
            : opts.QrBaseUrl.Trim();
        qrBase = qrBase.TrimEnd('/');

        // The data param URL-decodes to the JSON the iPad parses.
        var payload = JsonSerializer.Serialize(
            new PairingQrPayload(token, apiEndpoint), QrJson);
        var encoded = Uri.EscapeDataString(payload);

        return $"{qrBase}/pair?data={encoded}";
    }

    private sealed record PairingQrPayload(string PairingToken, string ApiEndpoint);
}
