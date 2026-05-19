namespace Tickets.Application.Pairing.Commands;

/// <summary>
/// Device scans the QR and completes pairing. No staff auth — the only proof
/// of identity is the one-time <see cref="PairingToken"/>.
/// </summary>
public sealed record CompletePairingCommand(
    string PairingToken,
    string DeviceName,
    string Mode);
