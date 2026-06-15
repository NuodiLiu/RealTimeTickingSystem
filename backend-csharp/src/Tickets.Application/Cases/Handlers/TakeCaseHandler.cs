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
/// Staff explicitly takes a case by id. No retry on concurrency conflict —
/// the staff picked the case deliberately, so a "someone else got it"
/// response is more informative than retrying. Distinguishes 404 (not found)
/// from 409 (already taken / not queued) to fix api-cases.md pitfall #15.
/// </summary>
public sealed class TakeCaseHandler(
    ICaseRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    ILogger<TakeCaseHandler> logger)
{
    public async Task<Result<CaseDto>> HandleAsync(TakeCaseCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is not { } staffId)
        {
            return Result<CaseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var caseId = new CaseId(command.CaseId);
        var theCase = await repository.FindByIdAsync(caseId, cancellationToken).ConfigureAwait(false);
        if (theCase is null)
        {
            return Result<CaseDto>.Failure(
                AppError.NotFound("case_not_found", $"Case {caseId} not found."));
        }

        try
        {
            theCase.Take(staffId, clock);
        }
        catch (DomainError ex)
        {
            return Result<CaseDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            await notifications.NotifyDashboardAsync(
                "case:updated",
                CaseDto.From(theCase),
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Dashboard notification for case:updated failed for {CaseId}", theCase.Id);
        }

        return Result<CaseDto>.Success(CaseDto.From(theCase));
    }
}
