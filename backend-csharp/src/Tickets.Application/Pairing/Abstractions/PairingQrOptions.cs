namespace Tickets.Application.Pairing.Abstractions;

/// <summary>
/// Bound from the <c>"Pairing"</c> configuration section. Drives the QR payload
/// the iPad scans.
/// <para>
/// The iPad's <c>PairingViewModel.extractPairingData</c> only accepts a scanned
/// string that contains <c>"/pair?data="</c> and whose <c>data</c> query param
/// URL-decodes to JSON <c>{ "pairingToken": "...", "apiEndpoint": "..." }</c>.
/// It then talks to <see cref="ApiEndpoint"/> for <c>/pair/complete</c>,
/// <c>/device/token</c>, etc. So the backend must embed BOTH the token and the
/// API base URL in the QR — the frontend <c>QRGeneratorModal</c> renders
/// <see cref="PairingTicketDto.QrUrl"/> verbatim into the QR image.
/// </para>
/// </summary>
public sealed class PairingQrOptions
{
    public const string SectionName = "Pairing";

    /// <summary>
    /// The public API base URL the iPad must call after scanning, embedded in
    /// the QR payload as <c>apiEndpoint</c>. e.g. <c>https://api.example.com</c>.
    /// </summary>
    public string ApiEndpoint { get; set; } = string.Empty;

    /// <summary>
    /// Base URL used to build the scannable <c>{QrBaseUrl}/pair?data=…</c> string.
    /// The host is cosmetic — the iPad only extracts the <c>data</c> param — but
    /// the path MUST contain <c>/pair?data=</c>. Defaults to <see cref="ApiEndpoint"/>
    /// when unset.
    /// </summary>
    public string QrBaseUrl { get; set; } = string.Empty;
}
