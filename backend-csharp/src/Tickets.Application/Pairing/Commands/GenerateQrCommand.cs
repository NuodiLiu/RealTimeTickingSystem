namespace Tickets.Application.Pairing.Commands;

/// <summary>
/// Staff requests a new pairing QR (legacy <c>POST /pair/generate-qr</c>).
/// No body — staff identity comes from <c>ICurrentUser</c>.
/// </summary>
public sealed record GenerateQrCommand;
