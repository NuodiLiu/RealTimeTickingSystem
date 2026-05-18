using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Events;

namespace Tickets.Domain.Cases.Events;

public sealed record CaseQueued(
    CaseId CaseId,
    StudentName StudentName,
    Category Category,
    ZId? ZId,
    DeviceId? CreatedByDeviceId,
    DateTimeOffset OccurredAt) : DomainEvent(OccurredAt);
