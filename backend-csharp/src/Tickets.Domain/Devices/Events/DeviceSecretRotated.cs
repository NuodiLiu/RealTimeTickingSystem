using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

public sealed record DeviceSecretRotated(
    DeviceId DeviceId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
