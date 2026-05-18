namespace Tickets.Domain.FeedbackSessions;

/// <summary>
/// Lifecycle state of a <see cref="FeedbackSession"/>. See AGENTS.md §4.2.
/// </summary>
public enum FeedbackSessionStatus
{
    /// <summary>Server-side session has been created; waiting for SignalR delivery ACK.</summary>
    Created,

    /// <summary>iPad has received the show-feedback message; awaiting customer input.</summary>
    Delivered,

    /// <summary>Terminal: customer submitted rating + comment.</summary>
    Submitted,

    /// <summary>Terminal: staff cancelled / force-resolved the case before submission.</summary>
    Cancelled,

    /// <summary>Terminal: another lock overrode the device.</summary>
    Overridden,

    /// <summary>Terminal: the 5-minute window elapsed without submission.</summary>
    Expired,
}
