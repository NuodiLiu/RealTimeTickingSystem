using FluentValidation;
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
/// Most complex application handler. Coordinates four aggregates inside one
/// unit of work:
/// <list type="number">
///   <item><c>FeedbackSession</c>: MarkDelivered (composite per AGENTS.md §4.2)
///         + Submit.</item>
///   <item><c>Case</c>: SubmitFeedback transition.</item>
///   <item><c>KioskDevice</c>: complete the lock that this session was holding
///         (CAS using current lock id + version).</item>
/// </list>
/// <para>
/// Mapped pitfalls:
/// <list type="bullet">
///   <item>api-feedback.md #16 — enforces <c>ICurrentDevice.DeviceId ==
///         session.DeviceId</c> before any state change.</item>
///   <item>api-feedback.md #7 — already-Submitted sessions return an
///         idempotent success rather than silently no-op'ing P2002.</item>
///   <item>api-feedback.md #9 — notifications are best-effort.</item>
/// </list>
/// </para>
/// </summary>
public sealed class SubmitFeedbackHandler(
    IFeedbackSessionRepository sessionRepository,
    ICaseRepository caseRepository,
    IKioskDeviceRepository deviceRepository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentDevice currentDevice,
    IValidator<SubmitFeedbackCommand> validator,
    ILogger<SubmitFeedbackHandler> logger)
{
    public async Task<Result<FeedbackSessionDto>> HandleAsync(
        SubmitFeedbackCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentDevice.DeviceId is not { } callerDevice)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Device authentication required."));
        }

        var validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.Validation(string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))));
        }

        var sessionId = new FeedbackSessionId(command.SessionId);
        var session = await sessionRepository.FindByIdAsync(sessionId, cancellationToken)
            .ConfigureAwait(false);
        if (session is null)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.NotFound("session_not_found", $"Session {sessionId} not found."));
        }

        // api-feedback.md #16: caller must own the session.
        if (session.DeviceId != callerDevice)
        {
            return Result<FeedbackSessionDto>.Failure(
                AppError.Forbidden(
                    "session_device_mismatch",
                    "Calling device does not own this feedback session."));
        }

        // Idempotent replay: a network retry on an already-submitted session
        // returns success with the existing snapshot.
        if (session.Status == FeedbackSessionStatus.Submitted)
        {
            return Result<FeedbackSessionDto>.Success(FeedbackSessionDto.From(session));
        }

        FeedbackRating rating;
        FeedbackComment? comment;
        try
        {
            rating = FeedbackRating.From(command.Rating);
            comment = string.IsNullOrWhiteSpace(command.Comment)
                ? null
                : FeedbackComment.Parse(command.Comment);
        }
        catch (ArgumentException ex)
        {
            return Result<FeedbackSessionDto>.Failure(AppError.Validation(ex.Message));
        }

        try
        {
            // If iPad's DELIVERED ACK was lost, the session is still Created.
            // The domain forbids skipping Delivered, so synthesise the ACK
            // here within the same transaction (AGENTS.md §4.2).
            if (session.Status == FeedbackSessionStatus.Created)
            {
                session.MarkDelivered(clock);
            }

            session.Submit(rating, comment, clock);
        }
        catch (DomainError ex)
        {
            return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        // Drive the case to Resolved.
        var theCase = await caseRepository
            .FindByIdAsync(session.CaseId, cancellationToken).ConfigureAwait(false);
        if (theCase is null)
        {
            // Orphan session — log and surface as conflict so admin can investigate.
            logger.LogError(
                "Feedback session {SessionId} references missing case {CaseId}",
                session.Id, session.CaseId);
            return Result<FeedbackSessionDto>.Failure(
                AppError.Conflict("case_missing_for_session", "Case for this session no longer exists."));
        }
        try
        {
            theCase.SubmitFeedback(clock);
        }
        catch (DomainError ex)
        {
            return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        // Release the device's lock if it is still the one this session was for.
        var device = await deviceRepository
            .FindByIdAsync(session.DeviceId, cancellationToken).ConfigureAwait(false);
        if (device?.CurrentLock is { } lk && lk.CaseId == session.CaseId)
        {
            try
            {
                device.CompleteLock(lk.Id, lk.Version, clock);
            }
            catch (DomainError ex)
            {
                return Result<FeedbackSessionDto>.Failure(DomainErrorMapper.ToAppError(ex));
            }
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        await SafeNotifyAsync(theCase, device, cancellationToken).ConfigureAwait(false);

        return Result<FeedbackSessionDto>.Success(FeedbackSessionDto.From(session));
    }

    private async Task SafeNotifyAsync(Case theCase, KioskDevice? device, CancellationToken ct)
    {
        try
        {
            await notifications.NotifyDashboardAsync(
                "case:updated",
                new { id = theCase.Id.Value, status = theCase.Status.ToString() },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "case:updated push failed for {CaseId}", theCase.Id);
        }

        if (device is null)
        {
            return;
        }

        try
        {
            await notifications.NotifyDashboardAsync(
                "device:updated",
                new { id = device.Id.Value, isBusy = false, isOnline = device.IsConnected },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "device:updated push failed for {DeviceId}", device.Id);
        }

        try
        {
            await notifications.PushToDeviceAsync(
                device.Id, "dismissDevice", new { }, ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "dismissDevice push failed for {DeviceId}", device.Id);
        }
    }
}
