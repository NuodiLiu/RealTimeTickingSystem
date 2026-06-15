using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Dtos;
using Tickets.Application.Common;
using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Cases.Handlers;

/// <summary>
/// Staff "grab the oldest queued case" workflow. Mirrors api-cases.md §4:
/// FIFO pick → CAS via the aggregate state machine → on contention, retry
/// up to <see cref="TakeNextCaseCommand.MaxAttempts"/>.
/// <para>
/// Returns success with <see cref="CaseDto"/>=<c>null</c> when the queue is
/// empty (legacy behaviour preserved). On exhausted retries, returns 409 so
/// the caller can show a "try again" prompt.
/// </para>
/// </summary>
public sealed class TakeNextCaseHandler(
    ICaseRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<TakeNextCaseHandler> logger)
{
    public async Task<Result<CaseDto?>> HandleAsync(
        TakeNextCaseCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is not { } staffId)
        {
            return Result<CaseDto?>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        if (command.MaxAttempts < 1)
        {
            return Result<CaseDto?>.Failure(
                AppError.Validation("maxAttempts must be >= 1."));
        }

        for (var attempt = 1; attempt <= command.MaxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var theCase = await repository.FindOldestQueuedAsync(cancellationToken).ConfigureAwait(false);
            if (theCase is null)
            {
                return Result<CaseDto?>.Success(value: null);
            }

            try
            {
                theCase.Take(staffId, clock);
                await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (ConcurrencyError)
            {
                // Another staff CAS'd this case first; pick a new one.
                logger.LogInformation(
                    "TakeNext attempt {Attempt} of {Max}: case {CaseId} taken by peer, retrying",
                    attempt, command.MaxAttempts, theCase.Id);
                continue;
            }
            catch (InvalidStateTransitionError)
            {
                // The repository returned a row that left QUEUED between
                // SELECT and UPDATE. Same situation as above — retry.
                continue;
            }
            catch (DomainError ex)
            {
                return Result<CaseDto?>.Failure(DomainErrorMapper.ToAppError(ex));
            }

            try
            {
                await notifications.NotifyDashboardAsync(
                    "case:updated",
                    CaseDto.From(theCase),
                    cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Dashboard notification for case:updated failed for {CaseId}", theCase.Id);
            }

            return Result<CaseDto?>.Success(CaseDto.From(theCase));
        }

        return Result<CaseDto?>.Failure(
            AppError.Conflict(
                "queue_contention",
                $"Could not take a case after {command.MaxAttempts} attempts."));
    }
}
