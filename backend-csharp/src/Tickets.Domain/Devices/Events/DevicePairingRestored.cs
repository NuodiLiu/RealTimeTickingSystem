using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Devices.Events;

/// <summary>
/// Emitted when a previously unpaired device is re-activated. Distinct from
/// <see cref="DevicePaired"/> (which fires only on initial pairing) so audit
/// log readers can distinguish "new device" from "device came back".
/// </summary>
public sealed record DevicePairingRestored(
    DeviceId DeviceId,
    DeviceMode Mode,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
