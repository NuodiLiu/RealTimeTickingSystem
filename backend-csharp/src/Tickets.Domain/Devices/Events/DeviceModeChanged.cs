using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

public sealed record DeviceModeChanged(
    DeviceId DeviceId,
    DeviceMode From,
    DeviceMode To,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
