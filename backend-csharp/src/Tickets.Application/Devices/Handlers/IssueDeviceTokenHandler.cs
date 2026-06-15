using Tickets.Application.Abstractions;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Common;
using Tickets.Application.Devices.Commands;
using Tickets.Application.Devices.Dtos;
using Tickets.Domain.Devices;

namespace Tickets.Application.Devices.Handlers;

/// <summary>
/// Issues the DEVICE App-JWT used as the SignalR negotiate Bearer
/// (<c>POST /device/token</c>). The caller authenticates with the device-header
/// scheme (<c>Authorization: Device id:secret</c>); the device id is taken from
/// the authenticated principal, never the request body, so a device cannot mint
/// a token for another device.
/// <para>
/// The minted token carries a distinct audience + <c>token_use=device</c>, so it
/// is rejected by the staff JwtBearer validation and can never call staff
/// endpoints.
/// </para>
/// </summary>
public sealed class IssueDeviceTokenHandler(
    IKioskDeviceRepository repository,
    ICurrentDevice currentDevice,
    IAppJwtIssuer jwtIssuer)
{
    public async Task<Result<DeviceTokenResponseDto>> HandleAsync(
        IssueDeviceTokenCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (currentDevice.DeviceId is not { } deviceId)
        {
            return Result<DeviceTokenResponseDto>.Failure(
                AppError.Unauthorized("not_authenticated", "Device authentication required."));
        }

        var device = await repository.FindByIdAsync(deviceId, cancellationToken).ConfigureAwait(false);
        if (device is null || !device.IsPaired)
        {
            return Result<DeviceTokenResponseDto>.Failure(
                AppError.NotFound("device_not_found", $"Device {deviceId} not found."));
        }

        var appJwt = jwtIssuer.IssueDeviceToken(device.Id, device.Mode);

        return Result<DeviceTokenResponseDto>.Success(
            new DeviceTokenResponseDto(appJwt.Token, appJwt.ExpireAt));
    }
}
