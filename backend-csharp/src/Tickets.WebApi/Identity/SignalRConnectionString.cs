namespace Tickets.WebApi.Identity;

/// <summary>
/// Parses the <c>AccessKey</c> out of an Azure SignalR connection string
/// (<c>Endpoint=https://…;AccessKey=&lt;key&gt;;Version=1.0;</c>). The access key is the
/// HMAC key Azure SignalR uses to sign upstream webhook calls (see
/// <see cref="WebhookSignatureOptions"/>).
/// </summary>
public static class SignalRConnectionString
{
    private const string AccessKeyToken = "AccessKey";

    /// <summary>
    /// Returns the AccessKey value, or null if the connection string is empty
    /// or contains no AccessKey segment.
    /// </summary>
    public static string? ExtractAccessKey(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        foreach (var segment in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var eq = segment.IndexOf('=', StringComparison.Ordinal);
            if (eq <= 0)
            {
                continue;
            }

            var key = segment[..eq].Trim();
            if (!key.Equals(AccessKeyToken, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // AccessKey values can themselves contain '=' (base64 padding), so
            // take everything after the FIRST '='.
            var value = segment[(eq + 1)..].Trim();
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }

        return null;
    }
}
