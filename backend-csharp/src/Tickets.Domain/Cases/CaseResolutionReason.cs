namespace Tickets.Domain.Cases;

/// <summary>
/// Why a case reached <see cref="CaseStatus.Resolved"/>.
/// Carried on the <c>CaseResolved</c> event so downstream consumers can
/// distinguish "user submitted feedback" from "staff force-resolved" etc.
/// </summary>
public enum CaseResolutionReason
{
    /// <summary>Staff resolved the case directly with no feedback step.</summary>
    ResolvedDirectly,

    /// <summary>The customer submitted feedback through the kiosk.</summary>
    FeedbackSubmitted,

    /// <summary>Staff force-resolved the case while feedback was pending.</summary>
    StaffForceResolved,

    /// <summary>Another lock overrode the device, abandoning this case.</summary>
    FeedbackOverridden,

    /// <summary>The feedback session timed out without submission.</summary>
    FeedbackExpired,

    /// <summary>
    /// Background cleanup released the case after a disconnect grace period.
    /// Fixes api-signalr.md pitfall #4 — disconnects no longer instantly resolve.
    /// </summary>
    DeviceLost,
}
