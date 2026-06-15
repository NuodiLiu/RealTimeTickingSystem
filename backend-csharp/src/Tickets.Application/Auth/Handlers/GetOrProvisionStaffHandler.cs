using Tickets.Application.Auth.Commands;
using Tickets.Application.Auth.Dtos;
using Tickets.Application.Common;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Handlers;

/// <summary>
/// Idempotent "ensure staff exists" flow used by the Azure AD callback.
/// Mirrors backend/src/services/staff.service.ts <c>getOrCreateStaff</c>:
/// <list type="number">
///   <item>Lookup by stable <c>identityKey</c> — happy path for returning users.</item>
///   <item>Lookup by email — handles IdP migration; the existing staff record's
///         identityKey is overwritten so future logins land on path 1.</item>
///   <item>Otherwise create a new <c>STAFF</c>-roled record.</item>
/// </list>
/// On every login the profile (name / email) is refreshed; the underlying
/// aggregate methods are idempotent so no event is raised when nothing
/// actually changed.
/// </summary>
public sealed class GetOrProvisionStaffHandler(
    IStaffRepository repository,
    IUnitOfWork unitOfWork,
    IClock clock)
{
    public async Task<Result<StaffDto>> HandleAsync(
        GetOrProvisionStaffCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (string.IsNullOrWhiteSpace(command.TenantId) ||
            string.IsNullOrWhiteSpace(command.ObjectId))
        {
            return Result<StaffDto>.Failure(
                AppError.Validation("tenantId and objectId are required."));
        }

        IdentityKey identityKey;
        EmployeeNo employeeNo;
        EmailAddress? email;
        try
        {
            identityKey = IdentityKey.FromAzureAd(command.TenantId, command.ObjectId);
            employeeNo = EmployeeNo.ForAzureAd(command.TenantId, command.ObjectId);
            email = string.IsNullOrWhiteSpace(command.Email)
                ? null
                : EmailAddress.Parse(command.Email);
        }
        catch (ArgumentException ex)
        {
            return Result<StaffDto>.Failure(AppError.Validation(ex.Message));
        }

        var byKey = await repository.FindByIdentityKeyAsync(identityKey, cancellationToken)
            .ConfigureAwait(false);
        if (byKey is not null)
        {
            return await ReturnAfterRefresh(byKey, email, command.DisplayName, cancellationToken)
                .ConfigureAwait(false);
        }

        if (email is { } e)
        {
            var byEmail = await repository.FindByEmailAsync(e, cancellationToken).ConfigureAwait(false);
            if (byEmail is not null)
            {
                try
                {
                    byEmail.MigrateIdentity(identityKey, clock);
                }
                catch (DomainError ex)
                {
                    return Result<StaffDto>.Failure(DomainErrorMapper.ToAppError(ex));
                }
                return await ReturnAfterRefresh(byEmail, email, command.DisplayName, cancellationToken)
                    .ConfigureAwait(false);
            }
        }

        if (email is null)
        {
            return Result<StaffDto>.Failure(
                AppError.Validation("email is required when provisioning a new staff record."));
        }

        Staff created;
        try
        {
            created = Staff.Provision(identityKey, email.Value, employeeNo, command.DisplayName, clock);
        }
        catch (DomainError ex)
        {
            return Result<StaffDto>.Failure(DomainErrorMapper.ToAppError(ex));
        }
        catch (ArgumentException ex)
        {
            return Result<StaffDto>.Failure(AppError.Validation(ex.Message));
        }

        await repository.AddAsync(created, cancellationToken).ConfigureAwait(false);
        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);

        return Result<StaffDto>.Success(StaffDto.From(created));
    }

    private async Task<Result<StaffDto>> ReturnAfterRefresh(
        Staff staff,
        EmailAddress? email,
        string? displayName,
        CancellationToken cancellationToken)
    {
        if (email is { } e)
        {
            try
            {
                staff.UpdateProfile(displayName ?? staff.Name, e, clock);
            }
            catch (DomainError ex)
            {
                return Result<StaffDto>.Failure(DomainErrorMapper.ToAppError(ex));
            }
        }

        await unitOfWork.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result<StaffDto>.Success(StaffDto.From(staff));
    }
}
