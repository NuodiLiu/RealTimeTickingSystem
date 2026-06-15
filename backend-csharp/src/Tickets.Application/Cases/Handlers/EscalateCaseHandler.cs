using FluentValidation;
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
/// Records escalation metadata (department, resolvedOnSite). Allowed only in
/// <c>InProgress</c> or <c>PendingFeedback</c> — the domain enforces this.
/// <para>
/// Fixes api-cases.md pitfall #6 (legacy did not broadcast) by emitting
/// <c>case:updated</c>; and pitfall #16 (no timestamp) is fixed by the
/// aggregate writing <c>EscalatedAt</c>.
/// </para>
/// </summary>
public sealed class EscalateCaseHandler(
    ICaseRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    ICurrentUser currentUser,
    IValidator<EscalateCaseCommand> validator,
    ILogger<EscalateCaseHandler> logger)
{
    public async Task<Result<CaseDto>> HandleAsync(
        EscalateCaseCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentUser.StaffId is null)
        {
            return Result<CaseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result<CaseDto>.Failure(
                AppError.Validation(string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))));
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
            theCase.Escalate(command.Department, command.ResolvedOnSite, clock);
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
            logger.LogWarning(ex,
                "Dashboard notification for case:updated failed for {CaseId}", theCase.Id);
        }

        return Result<CaseDto>.Success(CaseDto.From(theCase));
    }
}
