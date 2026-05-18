using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Dtos;
using Tickets.Application.Common;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Cases.Handlers;

/// <summary>
/// Resolves a case. The most complex handler in the Cases module — it
/// orchestrates updates across three aggregates when the case is in
/// <c>PendingFeedback</c>:
/// <list type="number">
///   <item>Force-resolve the <c>Case</c> (raises <c>CaseResolved</c>).</item>
///   <item>Cancel the active <c>FeedbackSession</c>.</item>
///   <item>Complete the <c>KioskLock</c> on the relevant device.</item>
/// </list>
/// All four writes commit atomically through <see cref="IUnitOfWork"/>.
/// Notifications (case:updated, device:updated, dismissDevice) happen after
/// commit and are best-effort — see api-cases.md pitfall #4.
/// </summary>
public sealed class ResolveCaseHandler(
    ICaseRepository caseRepository,
    IFeedbackSessionRepository sessionRepository,
    IKioskDeviceRepository deviceRepository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<ResolveCaseHandler> logger)
{
    public async Task<Result<CaseDto>> HandleAsync(
        ResolveCaseCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is null)
        {
            return Result<CaseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var caseId = new CaseId(command.CaseId);
        var theCase = await caseRepository.FindByIdAsync(caseId, cancellationToken).ConfigureAwait(false);
        if (theCase is null)
        {
            return Result<CaseDto>.Failure(
                AppError.NotFound("case_not_found", $"Case {caseId} not found."));
        }

        DeviceId? notifyDeviceId = null;
        try
        {
            switch (theCase.Status)
            {
                case CaseStatus.InProgress:
                    theCase.ResolveDirectly(clock);
                    break;

                case CaseStatus.PendingFeedback:
                    theCase.ForceResolve(clock);
                    notifyDeviceId = await ReleasePendingFeedbackArtifactsAsync(
                        caseId, cancellationToken).ConfigureAwait(false);
                    break;

                default:
                    return Result<CaseDto>.Failure(
                        new AppError(
                            "invalid_state_transition",
                            $"Cannot resolve a case in state '{theCase.Status}'.",
                            HttpStatus: 409));
            }
        }
        catch (DomainError ex)
        {
            return Result<CaseDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        await NotifyAsync(theCase, notifyDeviceId, cancellationToken).ConfigureAwait(false);

        return Result<CaseDto>.Success(CaseDto.From(theCase));
    }

    private async Task<DeviceId?> ReleasePendingFeedbackArtifactsAsync(
        CaseId caseId, CancellationToken cancellationToken)
    {
        var session = await sessionRepository
            .FindActiveByCaseAsync(caseId, cancellationToken)
            .ConfigureAwait(false);
        if (session is null)
        {
            // Anomaly: case was PendingFeedback but no active session. Log it;
            // the case is still resolved correctly because Case.ForceResolve
            // has already been called by the caller.
            logger.LogWarning(
                "Case {CaseId} was PendingFeedback but had no active feedback session.", caseId);
            return null;
        }

        session.Cancel(clock);

        var device = await deviceRepository
            .FindByIdAsync(session.DeviceId, cancellationToken)
            .ConfigureAwait(false);
        if (device?.CurrentLock is { } lk && lk.CaseId == caseId)
        {
            device.CompleteLock(lk.Id, lk.Version, clock);
        }

        return session.DeviceId;
    }

    private async Task NotifyAsync(Case theCase, DeviceId? deviceId, CancellationToken ct)
    {
        try
        {
            await notifications.NotifyDashboardAsync(
                "case:updated", CaseDto.From(theCase), ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Dashboard notification for case:updated failed for {CaseId}", theCase.Id);
        }

        if (deviceId is not { } d)
        {
            return;
        }

        try
        {
            await notifications.NotifyDashboardAsync(
                "device:updated",
                new { id = d.Value, isBusy = false, isOnline = true },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Dashboard notification for device:updated failed for {DeviceId}", d);
        }

        try
        {
            await notifications.PushToDeviceAsync(
                d, "dismissDevice", payload: new { }, ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Device push for dismissDevice failed for {DeviceId}", d);
        }
    }
}
