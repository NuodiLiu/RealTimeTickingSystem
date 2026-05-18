using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

public sealed record DeviceUnpaired(
    DeviceId DeviceId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
