using Tickets.Domain.Shared.Errors;

namespace Tickets.Domain.Devices.Errors;

/// <summary>
/// Raised when an operation requires the device to be in a specific mode but it
/// is not. Currently used by feedback flows that require <see cref="DeviceMode.Feedback"/>.
/// </summary>
public sealed class InvalidDeviceModeError(DeviceId deviceId, DeviceMode actual, DeviceMode expected)
    : DomainError(
        "invalid_device_mode",
        $"Device {deviceId} is in mode '{actual}' but '{expected}' is required.")
{
    public DeviceId DeviceId { get; } = deviceId;
    public DeviceMode Actual { get; } = actual;
    public DeviceMode Expected { get; } = expected;
}
