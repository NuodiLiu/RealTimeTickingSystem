using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Middleware;

/// <summary>
/// Verifies HMAC-SHA256 signature on Azure SignalR upstream webhook calls.
/// Fail-closed: if no secret is configured, every webhook request is rejected
/// with 503 — production deployments MUST set the secret. This is a hard
/// non-negotiable from api-signalr.md pitfall #1 (legacy left this off).
/// </summary>
public sealed class WebhookSignatureMiddleware(
    RequestDelegate next,
    IOptions<WebhookSignatureOptions> options,
    ILogger<WebhookSignatureMiddleware> logger)
{
    private const string SignaturePrefix = "sha256=";
    private const string HeaderName = "X-Asrs-Signature";
    private readonly WebhookSignatureOptions _opts = options.Value;

    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (string.IsNullOrEmpty(_opts.SigningSecret))
        {
            logger.LogError(
                "SignalRWebhook:SigningSecret is not configured — refusing webhook traffic.");
            await Reject(context, StatusCodes.Status503ServiceUnavailable,
                "webhook_secret_missing", "Webhook secret is not configured.");
            return;
        }

        var providedHeader = context.Request.Headers[HeaderName].ToString();
        if (string.IsNullOrEmpty(providedHeader) ||
            !providedHeader.StartsWith(SignaturePrefix, StringComparison.OrdinalIgnoreCase))
        {
            await Reject(context, StatusCodes.Status401Unauthorized,
                "missing_signature", "X-Asrs-Signature header is missing or malformed.");
            return;
        }

        context.Request.EnableBuffering();
        var body = await ReadBodyAsync(context).ConfigureAwait(false);
        context.Request.Body.Position = 0;

        if (!VerifyHmac(body, providedHeader[SignaturePrefix.Length..], _opts.SigningSecret))
        {
            await Reject(context, StatusCodes.Status401Unauthorized,
                "invalid_signature", "Webhook signature does not match.");
            return;
        }

        await next(context).ConfigureAwait(false);
    }

    private static async Task<byte[]> ReadBodyAsync(HttpContext context)
    {
        using var ms = new MemoryStream();
        await context.Request.Body.CopyToAsync(ms).ConfigureAwait(false);
        return ms.ToArray();
    }

    private static bool VerifyHmac(byte[] body, string suppliedHex, string secret)
    {
        Span<byte> computed = stackalloc byte[HMACSHA256.HashSizeInBytes];
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body, computed);
        var computedHex = Convert.ToHexString(computed);
        if (suppliedHex.Length != computedHex.Length)
        {
            return false;
        }
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(suppliedHex.ToUpperInvariant()),
            Encoding.UTF8.GetBytes(computedHex));
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
