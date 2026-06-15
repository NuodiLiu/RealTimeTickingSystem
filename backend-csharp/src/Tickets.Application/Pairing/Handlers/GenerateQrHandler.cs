using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Dtos;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Pairing.Handlers;

/// <summary>
/// Mints a pairing token, persists it with a 5-minute TTL, and returns the
/// payload staff displays as a QR. Replaces the legacy
/// <c>POST /pair/generate-qr</c> (api-pair.md §1).
/// </summary>
public sealed class GenerateQrHandler(
    IPairingTokenGenerator tokenGenerator,
    IPairingTokenStore tokenStore,
    IClock clock,
    ICurrentUser currentUser)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

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

        return Result<PairingTicketDto>.Success(new PairingTicketDto(token, expireAt));
    }
}
