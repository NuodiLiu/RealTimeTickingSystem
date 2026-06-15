using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Middleware;

/// <summary>
/// Verifies the Azure SignalR upstream webhook signature (#10).
/// <para>
/// Azure SignalR signs each upstream call as
/// <c>Hex(HMAC-SHA256(accessKey, connectionId))</c> using the primary AND
/// secondary access keys, and sends the result in the <c>X-ASRS-Signature</c>
/// header (each formatted <c>sha256=&lt;hex&gt;</c>, comma-joined). The
/// <c>connectionId</c> is the value of the <c>X-ASRS-Connection-Id</c> header —
/// NOT the request body. A request is accepted when ANY supplied signature
/// matches the HMAC of the connection id under ANY configured access key.
/// </para>
/// <para>
/// Fail-closed: if no access key is configured the middleware rejects every
/// webhook request with 503 — production MUST supply the SignalR connection
/// string (or an explicit key). This is a hard non-negotiable from
/// api-signalr.md pitfall #1.
/// </para>
/// </summary>
public sealed class WebhookSignatureMiddleware(
    RequestDelegate next,
    IOptions<WebhookSignatureOptions> options,
    ILogger<WebhookSignatureMiddleware> logger)
{
    private const string SignaturePrefix = "sha256=";
    private const string SignatureHeader = "X-ASRS-Signature";
    private const string ConnectionIdHeader = "X-ASRS-Connection-Id";
    private readonly WebhookSignatureOptions _opts = options.Value;

    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (_opts.AccessKeys.Count == 0)
        {
            logger.LogError(
                "No SignalR access key configured for webhook verification — refusing webhook traffic.");
            await Reject(context, StatusCodes.Status503ServiceUnavailable,
                "webhook_secret_missing", "Webhook signing key is not configured.");
            return;
        }

        var connectionId = context.Request.Headers[ConnectionIdHeader].ToString();
        if (string.IsNullOrEmpty(connectionId))
        {
            await Reject(context, StatusCodes.Status401Unauthorized,
                "missing_connection_id", "X-ASRS-Connection-Id header is missing.");
            return;
        }

        var providedHeader = context.Request.Headers[SignatureHeader].ToString();
        if (string.IsNullOrEmpty(providedHeader))
        {
            await Reject(context, StatusCodes.Status401Unauthorized,
                "missing_signature", "X-ASRS-Signature header is missing.");
            return;
        }

        if (!IsSignatureValid(connectionId, providedHeader))
        {
            await Reject(context, StatusCodes.Status401Unauthorized,
                "invalid_signature", "Webhook signature does not match.");
            return;
        }

        await next(context).ConfigureAwait(false);
    }

    private bool IsSignatureValid(string connectionId, string signatureHeader)
    {
        // The header may carry multiple comma-separated signatures (one per
        // access key on the service side). Accept if ANY supplied signature
        // matches the HMAC under ANY configured key.
        var supplied = signatureHeader.Split(
            ',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var contentBytes = Encoding.UTF8.GetBytes(connectionId);
        Span<byte> computed = stackalloc byte[HMACSHA256.HashSizeInBytes];

        foreach (var key in _opts.AccessKeys)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), contentBytes, computed);
            var expectedHex = Convert.ToHexString(computed); // upper-case hex

            foreach (var candidate in supplied)
            {
                var hex = candidate.StartsWith(SignaturePrefix, StringComparison.OrdinalIgnoreCase)
                    ? candidate[SignaturePrefix.Length..]
                    : candidate;

                if (hex.Length != expectedHex.Length)
                {
                    continue;
                }

                if (CryptographicOperations.FixedTimeEquals(
                        Encoding.ASCII.GetBytes(hex.ToUpperInvariant()),
                        Encoding.ASCII.GetBytes(expectedHex)))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static async Task Reject(HttpContext context, int status, string code, string description)
    {
        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(
            $"{{\"error\":\"{code}\",\"error_description\":\"{description}\"}}",
            System.Text.Encoding.UTF8).ConfigureAwait(false);
    }
}
