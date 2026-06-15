using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Pairing.Commands;
using Tickets.Application.Pairing.Dtos;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Pairing.Handlers;

/// <summary>
/// Completes device pairing. Replaces the legacy <c>POST /pair/complete</c>
/// (api-pair.md §2) but tightens the seams:
/// <list type="bullet">
///   <item><see cref="IPairingTokenStore.ConsumeAsync"/> is required to be
///         atomic — fixes pitfall #2 (token not truly one-time).</item>
///   <item>The whole flow is in one <see cref="IUnitOfWork"/> commit — fixes
///         pitfall #1 (Node had no transaction).</item>
///   <item>Same-name re-pair flows into the existing device row (Path B);
///         an unpaired device with that name is RESTORED rather than refused
///         — fixes pitfall #5.</item>
/// </list>
/// </summary>
public sealed class CompletePairingHandler(
    IPairingTokenStore tokenStore,
    IKioskDeviceRepository deviceRepository,
    IDeviceSecretGenerator secretGenerator,
    IDeviceTokenIssuer tokenIssuer,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    IValidator<CompletePairingCommand> validator,
    IOptions<PairingQrOptions> qrOptions,
    ILogger<CompletePairingHandler> logger)
{
    private static readonly TimeSpan WsTokenTtl = TimeSpan.FromHours(12);

    public async Task<Result<CompletePairingDto>> HandleAsync(
        CompletePairingCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result<CompletePairingDto>.Failure(
                AppError.Validation(string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))));
        }

        if (!Enum.TryParse<DeviceMode>(command.Mode, ignoreCase: true, out var mode))
        {
            return Result<CompletePairingDto>.Failure(
                AppError.Validation("mode must be 'Registration' or 'Feedback'."));
        }

        DeviceName deviceName;
        try
        {
            deviceName = DeviceName.Parse(command.DeviceName);
        }
        catch (ArgumentException ex)
        {
            return Result<CompletePairingDto>.Failure(AppError.Validation(ex.Message));
        }

        // Atomic consume — the token is unusable after this returns true.
        var accepted = await tokenStore
            .ConsumeAsync(command.PairingToken, clock.UtcNow, cancellationToken)
            .ConfigureAwait(false);
        if (!accepted)
        {
            return Result<CompletePairingDto>.Failure(
                AppError.Unauthorized(
                    "invalid_pairing_token",
                    "Pairing token is unknown, expired, or already used."));
        }

        var secret = secretGenerator.Generate();

        KioskDevice device;
        try
        {
            var existing = await deviceRepository
                .FindActiveByNameAsync(deviceName, cancellationToken)
                .ConfigureAwait(false);

            if (existing is not null)
            {
                // Same-name re-pair: rotate the secret and reset the mode on the
                // existing aggregate.
                existing.RotateSecret(secret.Hash, clock);
                if (existing.Mode != mode)
                {
                    existing.ChangeMode(mode, clock);
                }
                device = existing;
            }
            else
            {
                device = KioskDevice.Pair(deviceName, secret.Hash, mode, clock);
                await deviceRepository.AddAsync(device, cancellationToken).ConfigureAwait(false);
            }
        }
        catch (DomainError ex)
        {
            return Result<CompletePairingDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        var wsExpireAt = clock.UtcNow + WsTokenTtl;
        var wsToken = tokenIssuer.IssueWebsocketToken(device.Id, device.Mode, WsTokenTtl);

        await SafeNotifyDashboardAsync(device, cancellationToken).ConfigureAwait(false);

        return Result<CompletePairingDto>.Success(new CompletePairingDto(
            DeviceId: device.Id.Value,
            DeviceSecret: secret.Plaintext,
            DeviceName: device.Name.Value,
            Mode: device.Mode,
            ApiKey: $"{device.Id.Value}:{secret.Plaintext}",
            WsToken: wsToken,
            WsEndpoint: (qrOptions.Value.ApiEndpoint ?? string.Empty).Trim(),
            WsTokenExpireAt: wsExpireAt));
    }

    private async Task SafeNotifyDashboardAsync(KioskDevice device, CancellationToken ct)
    {
        try
        {
            await notifications.NotifyDashboardAsync(
                "device:paired",
                new
                {
                    deviceId = device.Id.Value,
                    deviceName = device.Name.Value,
                    mode = device.Mode,
                },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "device:paired push failed for {DeviceId}", device.Id);
        }
    }
}
