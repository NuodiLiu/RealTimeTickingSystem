using Tickets.Application.Abstractions;
using Tickets.Domain.Devices;

namespace Tickets.Application.Tests.Shared;

internal sealed class FakeCurrentDevice(DeviceId? deviceId = null) : ICurrentDevice
{
    public DeviceId? DeviceId { get; } = deviceId;

    public static FakeCurrentDevice AnonymousDevice() => new(null);
    public static FakeCurrentDevice Identified(DeviceId? id = null) =>
        new(id ?? Domain.Devices.DeviceId.New());
}
