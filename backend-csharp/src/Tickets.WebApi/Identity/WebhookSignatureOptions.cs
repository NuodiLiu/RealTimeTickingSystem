namespace Tickets.WebApi.Identity;

/// <summary>
/// Configures verification of Azure SignalR upstream webhook calls.
/// <para>
/// Azure SignalR signs each upstream request by computing
/// <c>Hex(HMAC-SHA256(accessKey, connectionId))</c> with BOTH the primary and
/// secondary access keys, and puts the result(s) in the
/// <c>X-ASRS-Signature</c> header (the SDK formats each as <c>sha256=&lt;hex&gt;</c>,
/// joined by commas when more than one). The <c>connectionId</c> is the value of
/// the <c>X-ASRS-Connection-Id</c> request header.
/// </para>
/// <para>
/// The signing key is therefore the SignalR <b>AccessKey</b>, NOT a separate
/// shared secret. <see cref="AccessKeys"/> are normally parsed from the
/// <c>Azure:SignalR:ConnectionString</c> (the composition root populates them);
/// they MAY also be supplied explicitly via the <c>SignalRWebhook:AccessKeys</c>
/// config array. If none are available the middleware fails closed.
/// </para>
/// </summary>
public sealed class WebhookSignatureOptions
{
    public const string SectionName = "SignalRWebhook";

    /// <summary>
    /// Access keys used as the HMAC key. A request is accepted if its signature
    /// matches the HMAC of the connection id under ANY of these keys. Empty -&gt;
    /// the middleware rejects everything (fail-closed).
    /// </summary>
    public IList<string> AccessKeys { get; } = new List<string>();
}
