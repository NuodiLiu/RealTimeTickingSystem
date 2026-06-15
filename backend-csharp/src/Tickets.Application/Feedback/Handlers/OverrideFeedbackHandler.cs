using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Feedback.Commands;
using Tickets.Application.Feedback.Dtos;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Feedback.Handlers;

/// <summary>
/// Override the active lock on a device, abandoning the old case in favour of
/// a new one. Mirrors the legacy <c>POST /feedback/override</c>
/// (api-feedback.md §2). Spans five aggregates atomically:
/// <list type="number">
///   <item><c>KioskDevice.OverrideLock</c> — CAS on (lockId, version); on
///         success creates the new lock and marks the old one Overridden.</item>
///   <item>Old <c>FeedbackSession</c> (if any): <c>MarkOverridden</c>.</item>
///   <item>Old <c>Case</c>: <c>FeedbackOverridden</c> → Resolved.</item>
///   <item>New <c>FeedbackSession</c> created for the replacement case.</item>
///   <item>New <c>Case</c>: <c>RequestFeedback</c>.</item>
/// </list>
/// Notifications are best-effort (api-feedback.md pitfall #9).
/// </summary>
public sealed class OverrideFeedbackHandler(
    ICaseRepository caseRepository,
    IKioskDeviceRepository deviceRepository,
    IFeedbackSessionRepository sessionRepository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<OverrideFeedbackHandler> logger)
{
    private static readonly TimeSpan LockLease = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan SessionWindow = TimeSpan.FromMinutes(5);

    public async Task<Result<FeedbackSessionDto>> HandleAsync(
        OverrideFeedbackCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is not { } staffId)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var deviceId = new DeviceId(command.DeviceId);
        var newCaseId = new CaseId(command.NewCaseId);
        var expectedLockId = new KioskLockId(command.ExpectedLockId);

        var device = await deviceRepository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        var newCase = await caseRepository.FindByIdAsync(newCaseId, cancellationToken).ConfigureAwait(false);
        if (newCase is null)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.NotFound("case_not_found", $"Case {newCaseId} not found."));
        }

        // Capture the old case id BEFORE overriding so we can find/transition it
        // afterwards. If the device has no current lock, OverrideLock will throw
        // LockNotActiveError which DomainErrorMapper turns into 409 'idle'.
        var oldLockCaseId = device.CurrentLock?.CaseId;

        KioskLock newLock;
        FeedbackSession newSession;
        try
        {
            device.EnsureModeIs(DeviceMode.Feedback);

            newLock = device.OverrideLock(
                expectedLockId,
                command.ExpectedLockVersion,
                staffId,
                newCaseId,
                LockLease,
                clock);

            newSession = FeedbackSession.Create(
                newCaseId, staffId, deviceId,
                expireAt: clock.UtcNow + SessionWindow,
                clock);

            newCase.RequestFeedback(deviceId, newLock.Id, newSession.Id, clock);
        }
        catch (DomainError ex)
        {
            return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        // Cascade: tear down the old session + case in the same transaction.
        if (oldLockCaseId is { } oldCaseId)
        {
            var oldSession = await sessionRepository
                .FindActiveByCaseAsync(oldCaseId, cancellationToken).ConfigureAwait(false);
            if (oldSession is not null)
            {
                try
                {
                    oldSession.MarkOverridden(clock);
                }
                catch (DomainError ex)
                {
                    return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
                }
            }

            var oldCase = await caseRepository.FindByIdAsync(oldCaseId, cancellationToken).ConfigureAwait(false);
            if (oldCase is not null && oldCase.Status == CaseStatus.PendingFeedback)
            {
                try
                {
                    oldCase.FeedbackOverridden(clock);
                }
                catch (DomainError ex)
                {
                    return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
                }
            }
        }

        await sessionRepository.AddAsync(newSession, cancellationToken).ConfigureAwait(false);
        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        await SafeNotifyAsync(device, newSession, oldLockCaseId, cancellationToken).ConfigureAwait(false);

        return Result<FeedbackSessionDto>.Success(FeedbackSessionDto.From(newSession));
    }

    private async Task SafeNotifyAsync(
        KioskDevice device,
        FeedbackSession newSession,
        CaseId? oldCaseId,
        CancellationToken ct)
    {
        // iPad: dismiss old, then show new.
        try
        {
            await notifications.PushToDeviceAsync(
                device.Id, "dismissDevice", new { }, ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "dismissDevice push failed for {DeviceId}", device.Id);
        }

        try
        {
            await notifications.PushToDeviceAsync(
                device.Id,
                "showFeedback",
                new
                {
                    sessionId = newSession.Id.Value,
                    caseId = newSession.CaseId.Value,
                    expireAt = newSession.ExpireAt,
                },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "showFeedback push (override) failed for {DeviceId}, session {SessionId}",
                device.Id, newSession.Id);
        }

        try
        {
            await notifications.NotifyDashboardAsync(
                "device:updated",
                new
                {
                    id = device.Id.Value,
                    isBusy = true,
                    isOnline = device.IsConnected,
                    currentCaseId = newSession.CaseId.Value,
                    overriddenCaseId = oldCaseId?.Value,
                },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "device:updated push (override) failed for {DeviceId}", device.Id);
        }
    }
}
