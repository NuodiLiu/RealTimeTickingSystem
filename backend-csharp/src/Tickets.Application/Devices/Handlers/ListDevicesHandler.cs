using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Dtos;
using Tickets.Application.Devices.Queries;
using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Handlers;

public sealed class ListDevicesHandler(
    IKioskDeviceRepository repository,
    ICurrentUser currentUser)
{
    private const int MaxPageSize = 200;

    public async Task<Result<IReadOnlyList<DeviceDto>>> HandleAsync(
        ListDevicesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is null)
        {
            return Result<IReadOnlyList<DeviceDto>>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        if (query.Page < 1)
        {
            return Result<IReadOnlyList<DeviceDto>>.Failure(
                AppError.Validation("page must be >= 1."));
        }
        if (query.PageSize is < 1 or > MaxPageSize)
        {
            return Result<IReadOnlyList<DeviceDto>>.Failure(
                AppError.Validation($"pageSize must be in [1, {MaxPageSize}]."));
        }

        var skip = (query.Page - 1) * query.PageSize;
        var rows = await repository
            .ListPairedAsync(query.Mode, skip, query.PageSize, cancellationToken)
            .ConfigureAwait(false);

        var dtos = rows.Select(DeviceDto.From).ToList();
        return Result<IReadOnlyList<DeviceDto>>.Success(dtos);
    }
}
