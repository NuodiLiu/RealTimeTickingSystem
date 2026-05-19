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
/// Sends a feedback request to a device. Equivalent to the legacy
/// <c>POST /feedback/send</c> (api-feedback.md §1) but reshaped to fit the
/// state-machine model:
/// <list type="number">
///   <item>Load case (must be <c>InProgress</c>) and device (must be Paired,
///         <c>Feedback</c> mode, Idle).</item>
///   <item>Acquire lock on device — the aggregate rejects if Busy.</item>
///   <item>Create the FeedbackSession bound to (case, staff, device).</item>
///   <item>Advance the case via <c>Case.RequestFeedback</c>.</item>
///   <item>Commit; then push <c>showFeedback</c> to iPad and
///         <c>device:updated</c> to the dashboard (best-effort).</item>
/// </list>
/// </summary>
public sealed class SendFeedbackHandler(
    ICaseRepository caseRepository,
    IKioskDeviceRepository deviceRepository,
    IFeedbackSessionRepository sessionRepository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<SendFeedbackHandler> logger)
{
    private static readonly TimeSpan LockLease = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan SessionWindow = TimeSpan.FromMinutes(5);

    public async Task<Result<FeedbackSessionDto>> HandleAsync(
        SendFeedbackCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is not { } staffId)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var caseId = new CaseId(command.CaseId);
        var deviceId = new DeviceId(command.DeviceId);

        var theCase = await caseRepository.FindByIdAsync(caseId, cancellationToken).ConfigureAwait(false);
        if (theCase is null)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.NotFound("case_not_found", $"Case {caseId} not found."));
        }

        var device = await deviceRepository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        // api-feedback.md pitfall: enforce one active session per case across
        // devices. Without this check the aggregate would still reject when we
        // tried to advance Case.RequestFeedback on a non-InProgress case, but a
        // targeted error message helps callers more.
        var existingSession = await sessionRepository
            .FindActiveByCaseAsync(caseId, cancellationToken).ConfigureAwait(false);
        if (existingSession is not null && existingSession.DeviceId != deviceId)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.Conflict(
                    "feedback_in_progress",
                    $"Case {caseId} already has an active feedback session on device {existingSession.DeviceId}."));
        }

        KioskLock acquiredLock;
        FeedbackSession session;
        try
        {
            device.EnsureModeIs(DeviceMode.Feedback);
            acquiredLock = device.AcquireLock(staffId, caseId, LockLease, clock);
            session = FeedbackSession.Create(
                caseId, staffId, deviceId,
                expireAt: clock.UtcNow + SessionWindow,
                clock);
            theCase.RequestFeedback(deviceId, acquiredLock.Id, session.Id, clock);
        }
        catch (DomainError ex)
        {
            return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await sessionRepository.AddAsync(session, cancellationToken).ConfigureAwait(false);
        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        await SafeNotifyAsync(device, session, cancellationToken).ConfigureAwait(false);

        return Result<FeedbackSessionDto>.Success(FeedbackSessionDto.From(session));
    }

    private async Task SafeNotifyAsync(
        KioskDevice device, FeedbackSession session, CancellationToken ct)
    {
        try
        {
            await notifications.PushToDeviceAsync(
                device.Id,
                "showFeedback",
                new
                {
                    sessionId = session.Id.Value,
                    caseId = session.CaseId.Value,
                    expireAt = session.ExpireAt,
                },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "showFeedback push failed for device {DeviceId}, session {SessionId}",
                device.Id, session.Id);
        }

        try
        {
            await notifications.NotifyDashboardAsync(
                "device:updated",
                new { id = device.Id.Value, isBusy = true, isOnline = device.IsConnected },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "device:updated push failed for {DeviceId}", device.Id);
        }
    }
}
