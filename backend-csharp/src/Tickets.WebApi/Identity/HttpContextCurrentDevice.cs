using Tickets.Application.Abstractions;
using Tickets.Domain.Devices;

namespace Tickets.WebApi.Identity;

/// <summary>
/// Reads the authenticated DeviceId from the <c>device_id</c> claim populated
/// by <see cref="DeviceAuthSchemeHandler"/>.
/// </summary>
internal sealed class HttpContextCurrentDevice(IHttpContextAccessor accessor) : ICurrentDevice
{
    public DeviceId? DeviceId
    {
        get
        {
            var raw = accessor.HttpContext?.User.FindFirst(DeviceAuthSchemeDefaults.DeviceIdClaim)?.Value;
            return Guid.TryParse(raw, out var g) ? new DeviceId(g) : null;
        }
    }
}
