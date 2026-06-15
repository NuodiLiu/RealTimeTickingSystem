namespace Tickets.Application.Devices.Configuration;

/// <summary>
/// Tunables for the device online-monitoring pipeline. Defaults assume an
/// iPad heartbeat period of 45 s — the "miss 2 beats" rule (industry IoT
/// convention) gives a 90 s offline threshold.
/// </summary>
public sealed class DeviceConnectivityOptions
{
    public const string SectionName = "DeviceConnectivity";

    /// <summary>How long without a heartbeat before the sweeper marks a device offline.</summary>
    public TimeSpan OfflineThreshold { get; set; } = TimeSpan.FromSeconds(90);

    /// <summary>How often the sweeper wakes up to scan for stale devices.</summary>
    public TimeSpan SweeperInterval { get; set; } = TimeSpan.FromSeconds(15);

    /// <summary>
    /// Suppresses the sweeper for this long after process start so a restart
    /// doesn't immediately flap every paired kiosk to offline before the
    /// first round of heartbeats lands.
    /// </summary>
    public TimeSpan StartupGracePeriod { get; set; } = TimeSpan.FromMinutes(3);
}
