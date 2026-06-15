namespace Tickets.Application.Pairing.Dtos;

/// <summary>
/// Payload returned to staff when generating a pairing QR.
/// <para>
/// Matches the frontend's <c>PairGenerateQrRes { qrUrl, pairingToken, sessionId,
/// expiresAt }</c>. The <c>QRGeneratorModal</c> renders <see cref="QrUrl"/>
/// verbatim into the QR image; the iPad scans it, extracts the embedded
/// <c>pairingToken</c> + <c>apiEndpoint</c>, and calls <c>/pair/complete</c>.
/// </para>
/// </summary>
public sealed record PairingTicketDto(
    string QrUrl,
    string PairingToken,
    string SessionId,
    DateTimeOffset ExpiresAt);
