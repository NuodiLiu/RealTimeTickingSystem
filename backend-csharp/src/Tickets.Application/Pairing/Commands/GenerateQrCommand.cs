namespace Tickets.Application.Pairing.Commands;

/// <summary>
/// Staff requests a new pairing QR (legacy <c>POST /pair/generate-qr</c>).
/// Staff identity comes from <c>ICurrentUser</c>. The optional <see cref="Mode"/>
/// / <see cref="DeviceLabel"/> mirror the frontend's
/// <c>PairGenerateQrReq { mode, deviceLabel }</c> — they are accepted for
/// forward-compat but the device chooses its own mode at <c>/pair/complete</c>.
/// </summary>
public sealed record GenerateQrCommand(string? Mode = null, string? DeviceLabel = null);
