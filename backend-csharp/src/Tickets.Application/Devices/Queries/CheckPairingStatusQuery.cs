namespace Tickets.Application.Devices.Queries;

/// <summary>
/// No-auth lookup the iPad uses on cold-start to decide whether to enter
/// the pairing flow. Replaces legacy <c>GET /device/pairing-status/{id}</c>.
/// </summary>
public sealed record CheckPairingStatusQuery(Guid DeviceId);
