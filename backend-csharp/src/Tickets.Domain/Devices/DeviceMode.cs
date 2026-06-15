namespace Tickets.Domain.Devices;

/// <summary>
/// Operational mode of a kiosk device. Mirrors the Postgres enum
/// <c>DeviceMode</c> in the existing Node schema.
/// </summary>
public enum DeviceMode
{
    Registration,
    Feedback,
}
