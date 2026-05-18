using FluentValidation;
using Microsoft.Extensions.Logging;
using Tickets.Application.Abstractions;
using Tickets.Application.Cases.Commands;
using Tickets.Application.Cases.Dtos;
using Tickets.Application.Common;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Cases.Handlers;

/// <summary>
/// Handles <see cref="PostCaseCommand"/> — creates a queued <see cref="Case"/>
/// and broadcasts <c>case:created</c> to the dashboard.
/// <para>
/// Mirrors <c>POST /cases</c> in the legacy Node backend (see api-cases.md §1).
/// Notable improvements over Node:
/// <list type="bullet">
///   <item>SignalR push failures are swallowed (api-cases.md pitfall #4).</item>
///   <item><see cref="Case.CreatedByDeviceId"/> is persisted, fixing pitfall #7.</item>
/// </list>
/// </para>
/// </summary>
public sealed class PostCaseHandler(
    ICaseRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock,
    INotificationGateway notifications,
    IValidator<PostCaseCommand> validator,
    ILogger<PostCaseHandler> logger)
{
    public async Task<Result<CaseDto>> HandleAsync(PostCaseCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join("; ", validation.Errors.Select(e => e.ErrorMessage));
            return Result<CaseDto>.Failure(AppError.Validation(message));
        }

        Case theCase;
        try
        {
            var name = StudentName.Parse(command.StudentName);
            var category = Category.Parse(command.Category);
            var zId = ZId.TryParse(command.ZId, out var parsedZ) ? parsedZ : (ZId?)null;
            var deviceId = command.CreatedByDeviceId is { } g ? new DeviceId(g) : (DeviceId?)null;

            theCase = Case.Queue(name, category, zId, deviceId, clock);
        }
        catch (DomainError ex)
        {
            return Result<CaseDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }
        catch (ArgumentException ex)
        {
            // Value-object construction rejected the input (e.g. empty name) —
            // surface as a 400 rather than letting it propagate as 500.
            return Result<CaseDto>.Failure(AppError.Validation(ex.Message));
        }

        await repository.AddAsync(theCase, cancellationToken).ConfigureAwait(false);
        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        // Best-effort real-time notification — must not fail the request
        // (AGENTS.md §7 #6 and api-cases.md pitfall #4).
        try
        {
            await notifications.NotifyDashboardAsync(
                "case:created",
                CaseDto.From(theCase),
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Dashboard notification for case:created failed for {CaseId}", theCase.Id);
        }

        return Result<CaseDto>.Success(CaseDto.From(theCase));
    }
}
