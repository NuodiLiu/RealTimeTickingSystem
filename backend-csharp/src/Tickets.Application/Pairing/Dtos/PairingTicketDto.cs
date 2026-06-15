namespace Tickets.Application.Pairing.Dtos;

/// <summary>
/// Payload returned to staff when generating a pairing QR. Matches the
/// legacy Node response shape (api-pair.md §1).
/// </summary>
public sealed record PairingTicketDto(
    string PairingToken,
    DateTimeOffset ExpireAt);
