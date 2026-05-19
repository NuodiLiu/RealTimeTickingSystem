using Tickets.Application.Abstractions;
using Tickets.Domain.Devices;

namespace Tickets.WebApi.Identity;

/// <summary>
/// Reads the authenticated DeviceId from <c>HttpContext.Items</c>. The Device
/// auth scheme (Phase 4 follow-up) stashes it there after verifying the
/// <c>Authorization: Device &lt;id&gt;:&lt;secret&gt;</c> header.
/// </summary>
internal sealed class HttpContextCurrentDevice(IHttpContextAccessor accessor) : ICurrentDevice
{
    public const string ItemKey = "Tickets.AuthenticatedDeviceId";

    public DeviceId? DeviceId
    {
        get
        {
            if (accessor.HttpContext?.Items[ItemKey] is DeviceId id)
            {
                return id;
            }
            return null;
        }
    }
}
