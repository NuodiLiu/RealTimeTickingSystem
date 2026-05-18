using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

public sealed record DevicePaired(
    DeviceId DeviceId,
    DeviceName Name,
    DeviceMode Mode,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
