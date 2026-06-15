using Microsoft.Extensions.Options;
using Tickets.Application.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Configuration;
using Tickets.Application.Devices.Dtos;
using Tickets.Application.Devices.Queries;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;

namespace Tickets.Application.Devices.Handlers;

public sealed class ListDevicesHandler(
    IKioskDeviceRepository repository,
    ICurrentUser currentUser,
    IClock clock,
    IOptions<DeviceConnectivityOptions> connectivityOptions)
{
    private const int MaxPageSize = 200;

    private readonly TimeSpan _offlineThreshold = connectivityOptions.Value.OfflineThreshold;

    public async Task<Result<DeviceListResponseDto>> HandleAsync(
        ListDevicesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (currentUser.StaffId is null)
        {
            return Result<DeviceListResponseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Staff authentication required."));
        }

        if (query.Page < 1)
        {
            return Result<DeviceListResponseDto>.Failure(
                AppError.Validation("page must be >= 1."));
        }
        if (query.PageSize is < 1 or > MaxPageSize)
        {
            return Result<DeviceListResponseDto>.Failure(
                AppError.Validation($"pageSize must be in [1, {MaxPageSize}]."));
        }

        var skip = (query.Page - 1) * query.PageSize;
        var rows = await repository
            .ListPairedAsync(query.Mode, skip, query.PageSize, cancellationToken)
            .ConfigureAwait(false);

        var items = rows
            .Select(d => DeviceDto.From(d, clock, _offlineThreshold))
            .ToList();
        return Result<DeviceListResponseDto>.Success(new DeviceListResponseDto(items));
    }
}
