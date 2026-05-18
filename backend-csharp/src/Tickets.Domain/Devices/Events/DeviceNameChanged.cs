using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

public sealed record DeviceNameChanged(
    DeviceId DeviceId,
    DeviceName NewName,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
