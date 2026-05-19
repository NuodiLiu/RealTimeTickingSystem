using Microsoft.Extensions.Options;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Auth.Commands;
using Tickets.Application.Auth.Dtos;
using Tickets.Application.Common;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;

namespace Tickets.Application.Auth.Handlers;

/// <summary>
/// Validates the supplied refresh handle, looks up the staff, issues a fresh
/// App-JWT, and atomically rotates the handle. If the handle is unknown,
/// expired, or already consumed, returns 401.
/// </summary>
public sealed class RefreshTokenHandler(
    IRefreshHandleStore handleStore,
    IStaffRepository staffRepository,
    IAppJwtIssuer jwtIssuer,
    IClock clock,
    IOptions<AppJwtOptions> options)
{
    private readonly AppJwtOptions _opts = options.Value;

    public async Task<Result<TokenPairDto>> HandleAsync(
        RefreshTokenCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (string.IsNullOrWhiteSpace(command.RefreshHandle))
        {
            return Result<TokenPairDto>.Failure(
                AppError.Unauthorized("missing_refresh", "Refresh handle is required."));
        }

        var record = await handleStore
            .FindAsync(command.RefreshHandle, clock.UtcNow, cancellationToken)
            .ConfigureAwait(false);
        if (record is null)
        {
            return Result<TokenPairDto>.Failure(
                AppError.Unauthorized("invalid_refresh", "Refresh handle is invalid or expired."));
        }

        var staff = await staffRepository
            .FindByIdAsync(record.StaffId, cancellationToken)
            .ConfigureAwait(false);
        if (staff is null)
        {
            // Orphan handle: the staff record disappeared between issuance
            // and refresh. Wipe the handle so future replays fail fast.
            await handleStore.DeleteAsync(command.RefreshHandle, cancellationToken).ConfigureAwait(false);
            return Result<TokenPairDto>.Failure(
                AppError.Unauthorized("staff_not_found", "Staff record no longer exists."));
        }

        var newExpireAt = clock.UtcNow + _opts.RefreshTtl;
        var newHandle = await handleStore
            .RotateAsync(command.RefreshHandle, clock.UtcNow, newExpireAt, cancellationToken)
            .ConfigureAwait(false);
        if (newHandle is null)
        {
            // Rotation can fail under concurrent refresh — same outcome as
            // an invalid handle, return 401 so the client re-authenticates.
            return Result<TokenPairDto>.Failure(
                AppError.Unauthorized("refresh_race", "Refresh handle was rotated concurrently."));
        }

        var jwt = jwtIssuer.Issue(staff.Id, staff.Role);

        return Result<TokenPairDto>.Success(new TokenPairDto(
            AccessToken: jwt.Token,
            AccessTokenExpireAt: jwt.ExpireAt,
            RefreshHandle: newHandle,
            RefreshExpireAt: newExpireAt));
    }
}
