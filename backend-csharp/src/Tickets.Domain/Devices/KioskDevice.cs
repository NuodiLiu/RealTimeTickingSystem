using Tickets.Domain.Cases;
using Tickets.Domain.Devices.Errors;
using Tickets.Domain.Devices.Events;
using Tickets.Domain.Shared.Aggregates;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;

namespace Tickets.Domain.Devices;

/// <summary>
/// Aggregate root for a kiosk device. Owns its <see cref="KioskLock"/> as an
/// internal entity, so callers can never observe a lock outside of its owning
/// device.
/// <para>
/// State machine (see AGENTS.md §4.3):
/// <code>
///   Unpaired ──Pair──► Paired/Idle ──AcquireLock──► Paired/Busy
///       ▲                  ▲  │                          │
///       │  Unpair (Idle    │  │ CompleteLock /            │
///       │   only)          │  │ ExpireLock                │
///       │                  │  ▼                          ▼
///       └── RestorePairing ◄── (same Idle)        OverrideLock
///                                                  (Busy → Busy)
/// </code>
/// Connectivity (<see cref="IsConnected"/>) is intentionally decoupled from the
/// lock state — disconnect events no longer auto-release locks (fixes
/// api-signalr.md pitfall #4).
/// </para>
/// </summary>
public sealed class KioskDevice : AggregateRoot
{
    public DeviceId Id { get; }
    public DeviceName Name { get; private set; }
    public SecretHash SecretHash { get; private set; }
    public DeviceMode Mode { get; private set; }
    public PairingStatus PairingStatus { get; private set; }
    public DateTimeOffset LastSeenAt { get; private set; }
    public bool IsConnected { get; private set; }
    public KioskLock? CurrentLock { get; private set; }

    public bool IsPaired => PairingStatus == PairingStatus.Paired;
    public bool IsBusy => CurrentLock is not null;

    // EF-friendly private ctor; not callable from product code.
    private KioskDevice(
        DeviceId id,
        DeviceName name,
        SecretHash secretHash,
        DeviceMode mode,
        PairingStatus pairingStatus,
        DateTimeOffset lastSeenAt,
        bool isConnected,
        KioskLock? currentLock)
    {
        Id = id;
        Name = name;
        SecretHash = secretHash;
        Mode = mode;
        PairingStatus = pairingStatus;
        LastSeenAt = lastSeenAt;
        IsConnected = isConnected;
        CurrentLock = currentLock;
    }

    // ───── Pairing lifecycle ─────────────────────────────────────────────

    /// <summary>Creates a brand-new paired device.</summary>
    public static KioskDevice Pair(DeviceName name, SecretHash secret, DeviceMode mode, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        var device = new KioskDevice(
            id: DeviceId.New(),
            name: name,
            secretHash: secret,
            mode: mode,
            pairingStatus: PairingStatus.Paired,
            lastSeenAt: clock.UtcNow,
            isConnected: false,
            currentLock: null);

        device.BumpVersion();
        device.RaiseEvent(new DevicePaired(device.Id, name, mode, clock.UtcNow));
        return device;
    }

    /// <summary>Re-issues credentials for a currently paired device.</summary>
    public void RotateSecret(SecretHash newSecret, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsurePaired();

        SecretHash = newSecret;
        BumpVersion();
        RaiseEvent(new DeviceSecretRotated(Id, clock.UtcNow));
    }

    /// <summary>
    /// Soft-deletes the device. Requires the device to be Idle (no active lock).
    /// Clears the secret so the old API key can no longer authenticate.
    /// </summary>
    public void Unpair(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsurePaired();
        EnsureIdle();

        PairingStatus = PairingStatus.Unpaired;
        SecretHash = SecretHash.Empty;
        IsConnected = false;
        BumpVersion();
        RaiseEvent(new DeviceUnpaired(Id, clock.UtcNow));
    }

    /// <summary>
    /// Re-activates a previously unpaired device. Fixes api-pair.md pitfall #5
    /// (Node system could not restore a soft-deleted device).
    /// </summary>
    public void RestorePairing(SecretHash newSecret, DeviceMode mode, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        if (PairingStatus == PairingStatus.Paired)
        {
            throw new DeviceAlreadyPairedError(Id);
        }

        PairingStatus = PairingStatus.Paired;
        SecretHash = newSecret;
        Mode = mode;
        LastSeenAt = clock.UtcNow;
        IsConnected = false;
        BumpVersion();
        RaiseEvent(new DevicePairingRestored(Id, mode, clock.UtcNow));
    }

    // ───── Connectivity ──────────────────────────────────────────────────

    /// <summary>
    /// Heartbeat from the device (HTTP or SignalR). Always updates LastSeenAt;
    /// raises an event only when transitioning from disconnected to connected.
    /// </summary>
    public void RecordHeartbeat(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsurePaired();

        LastSeenAt = clock.UtcNow;
        if (!IsConnected)
        {
            IsConnected = true;
            BumpVersion();
            RaiseEvent(new DeviceConnectionStateChanged(Id, IsConnected: true, LastSeenAt, clock.UtcNow));
        }
    }

    /// <summary>
    /// Webhook-driven disconnect notice. Does NOT touch the current lock — that
    /// remains for the background cleanup job to handle once the lease expires.
    /// </summary>
    public void MarkDisconnected(IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);

        if (!IsConnected)
        {
            return;
        }

        IsConnected = false;
        BumpVersion();
        RaiseEvent(new DeviceConnectionStateChanged(Id, IsConnected: false, LastSeenAt, clock.UtcNow));
    }

    /// <summary>
    /// Hybrid online check: requires both the connectivity flag and a recent
    /// heartbeat. Fixes api-device.md pitfall #1 (double-track online logic).
    /// </summary>
    public bool IsOnline(IClock clock, TimeSpan staleAfter)
    {
        ArgumentNullException.ThrowIfNull(clock);
        if (!IsConnected)
        {
            return false;
        }
        return clock.UtcNow - LastSeenAt <= staleAfter;
    }

    // ───── Identity / Mode ───────────────────────────────────────────────

    public void ChangeName(DeviceName newName, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsurePaired();

        if (newName == Name)
        {
            return;
        }

        Name = newName;
        BumpVersion();
        RaiseEvent(new DeviceNameChanged(Id, newName, clock.UtcNow));
    }

    /// <summary>Switches operational mode. Requires Idle (no active lock).</summary>
    public void ChangeMode(DeviceMode newMode, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsurePaired();
        EnsureIdle();

        if (newMode == Mode)
        {
            return;
        }

        var from = Mode;
        Mode = newMode;
        BumpVersion();
        RaiseEvent(new DeviceModeChanged(Id, from, newMode, clock.UtcNow));
    }

    /// <summary>
    /// Throws if the device is not in <see cref="DeviceMode.Feedback"/>.
    /// Called by feedback flows (Application layer) before creating a session.
    /// </summary>
    public void EnsureModeIs(DeviceMode required)
    {
        if (Mode != required)
        {
            throw new InvalidDeviceModeError(Id, Mode, required);
        }
    }

    // ───── Lock lifecycle ────────────────────────────────────────────────

    public KioskLock AcquireLock(StaffId staffId, CaseId caseId, TimeSpan leaseDuration, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        EnsurePaired();
        if (CurrentLock is not null)
        {
            throw new DeviceBusyError(Id, CurrentLock.Id);
        }

        var lk = new KioskLock(
            id: KioskLockId.New(),
            staffId: staffId,
            caseId: caseId,
            createdAt: clock.UtcNow,
            leaseExpireAt: clock.UtcNow + leaseDuration,
            version: 1);

        CurrentLock = lk;
        BumpVersion();
        RaiseEvent(new LockAcquired(Id, lk.Id, staffId, caseId, lk.LeaseExpireAt, clock.UtcNow));
        return lk;
    }

    public void CompleteLock(KioskLockId expectedLockId, uint expectedVersion, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        var lk = EnsureLockMatches(expectedLockId, expectedVersion);

        CurrentLock = null;
        BumpVersion();
        RaiseEvent(new LockCompleted(Id, lk.Id, lk.CaseId, clock.UtcNow));
    }

    public KioskLock OverrideLock(
        KioskLockId expectedLockId,
        uint expectedVersion,
        StaffId newStaffId,
        CaseId newCaseId,
        TimeSpan leaseDuration,
        IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        var oldLk = EnsureLockMatches(expectedLockId, expectedVersion);

        var newLk = new KioskLock(
            id: KioskLockId.New(),
            staffId: newStaffId,
            caseId: newCaseId,
            createdAt: clock.UtcNow,
            leaseExpireAt: clock.UtcNow + leaseDuration,
            version: 1);

        CurrentLock = newLk;
        BumpVersion();
        RaiseEvent(new LockOverridden(
            Id,
            OldLockId: oldLk.Id,
            OldCaseId: oldLk.CaseId,
            NewLockId: newLk.Id,
            NewStaffId: newStaffId,
            NewCaseId: newCaseId,
            NewLeaseExpireAt: newLk.LeaseExpireAt,
            OccurredAt: clock.UtcNow));
        return newLk;
    }

    /// <summary>
    /// Releases an expired lock. Called by the background cleanup job after
    /// confirming <see cref="KioskLock.LeaseExpireAt"/> &lt; now.
    /// </summary>
    public void ExpireLock(KioskLockId expectedLockId, IClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        if (CurrentLock is null)
        {
            throw new LockNotActiveError(Id);
        }
        if (CurrentLock.Id != expectedLockId)
        {
            throw new LockPreconditionFailedError(
                Id, expectedLockId, CurrentLock.Version, CurrentLock.Id, CurrentLock.Version);
        }
        if (clock.UtcNow < CurrentLock.LeaseExpireAt)
        {
            throw new LockLeaseNotExpiredError(Id, CurrentLock.Id, CurrentLock.LeaseExpireAt, clock.UtcNow);
        }

        var lk = CurrentLock;
        CurrentLock = null;
        BumpVersion();
        RaiseEvent(new LockExpired(Id, lk.Id, lk.CaseId, clock.UtcNow));
    }

    // ───── Guards ────────────────────────────────────────────────────────

    private void EnsurePaired()
    {
        if (PairingStatus != PairingStatus.Paired)
        {
            throw new DeviceNotPairedError(Id);
        }
    }

    private void EnsureIdle()
    {
        if (CurrentLock is not null)
        {
            throw new DeviceBusyError(Id, CurrentLock.Id);
        }
    }

    private KioskLock EnsureLockMatches(KioskLockId expectedLockId, uint expectedVersion)
    {
        if (CurrentLock is null)
        {
            throw new LockNotActiveError(Id);
        }
        if (CurrentLock.Id != expectedLockId || CurrentLock.Version != expectedVersion)
        {
            throw new LockPreconditionFailedError(
                Id,
                expectedLockId, expectedVersion,
                CurrentLock.Id, CurrentLock.Version);
        }
        return CurrentLock;
    }
}
