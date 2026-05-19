namespace Tickets.WebApi.Identity;

/// <summary>
/// Bound from <c>"SignalRWebhook"</c> section. Azure SignalR adds the
/// <c>X-Asrs-Signature</c> header equal to <c>"sha256=" + HEX(HMAC-SHA256(secret, body))</c>;
/// the middleware computes the same and rejects mismatches.
/// </summary>
public sealed class WebhookSignatureOptions
{
    public const string SectionName = "SignalRWebhook";

    /// <summary>Shared HMAC secret. If empty, the middleware rejects everything (fail-closed).</summary>
    public string SigningSecret { get; set; } = string.Empty;
}
