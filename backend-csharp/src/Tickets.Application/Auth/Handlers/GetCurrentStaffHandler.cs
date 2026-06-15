using Tickets.Application.Abstractions;
using Tickets.Application.Auth.Dtos;
using Tickets.Application.Auth.Queries;
using Tickets.Application.Common;
using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Handlers;

/// <summary>
/// Returns the staff record bound to the current request. WebApi calls this
/// from <c>GET /auth/me</c> after the JWT middleware has populated
/// <see cref="ICurrentUser.StaffId"/>.
/// </summary>
public sealed class GetCurrentStaffHandler(
    IStaffRepository repository,
    ICurrentUser currentUser)
{
    public async Task<Result<StaffDto>> HandleAsync(
        GetCurrentStaffQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is not { } staffId)
        {
            return Result<StaffDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        var staff = await repository.FindByIdAsync(staffId, cancellationToken).ConfigureAwait(false);
        if (staff is null)
        {
            return Result<StaffDto>.Failure(
                AppError.NotFound("staff_not_found", "Staff record not found."));
        }

        return Result<StaffDto>.Success(StaffDto.From(staff));
    }
}
