namespace Tickets.Domain.Devices;

/// <summary>
/// Top-level lifecycle state of a kiosk device.
/// <para>
/// <see cref="Unpaired"/> replaces the Node soft-delete pattern
/// (<c>KioskDevice.deletedAt != null</c>). The new system allows transitioning
/// back to <see cref="Paired"/> via <c>KioskDevice.RestorePairing</c> — this
/// fixes api-pair.md known pitfall #5 ("软删除设备无法通过配对复活").
/// </para>
/// </summary>
public enum PairingStatus
{
    Unpaired,
    Paired,
}
