using Tickets.Domain.Devices;

namespace Tickets.Application.Abstractions;

/// <summary>
/// Ambient information about the device whose API key authenticated the
/// current HTTP request. Bound in WebApi by the device-auth middleware; null
/// when the call is not device-authenticated.
/// </summary>
public interface ICurrentDevice
{
    DeviceId? DeviceId { get; }
}
