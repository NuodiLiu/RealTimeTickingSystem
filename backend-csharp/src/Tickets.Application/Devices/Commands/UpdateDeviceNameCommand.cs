namespace Tickets.Application.Devices.Commands;

public sealed record UpdateDeviceNameCommand(Guid DeviceId, string Name);
