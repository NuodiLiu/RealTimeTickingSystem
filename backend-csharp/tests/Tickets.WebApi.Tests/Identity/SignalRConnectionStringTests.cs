using Tickets.WebApi.Identity;

namespace Tickets.WebApi.Tests.Identity;

/// <summary>
/// Pure unit tests for the SignalR connection-string AccessKey parser (#10).
/// No host / Docker needed.
/// </summary>
public sealed class SignalRConnectionStringTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Endpoint=https://x.service.signalr.net;Version=1.0;")]
    public void ExtractAccessKey_NoKey_ReturnsNull(string? connectionString)
    {
        SignalRConnectionString.ExtractAccessKey(connectionString).Should().BeNull();
    }

    [Fact]
    public void ExtractAccessKey_StandardConnectionString_ReturnsKey()
    {
        const string cs =
            "Endpoint=https://x.service.signalr.net;AccessKey=abc123XYZ;Version=1.0;";

        SignalRConnectionString.ExtractAccessKey(cs).Should().Be("abc123XYZ");
    }

    [Fact]
    public void ExtractAccessKey_KeyContainsBase64Padding_KeepsEverythingAfterFirstEquals()
    {
        // Real access keys are base64 and can end in '=' padding.
        const string cs =
            "Endpoint=https://x.service.signalr.net;AccessKey=YWJjZGVmZ2g=;Version=1.0;";

        SignalRConnectionString.ExtractAccessKey(cs).Should().Be("YWJjZGVmZ2g=");
    }

    [Fact]
    public void ExtractAccessKey_IsCaseInsensitiveOnKeyName()
    {
        const string cs =
            "endpoint=https://x.service.signalr.net;accesskey=lower;version=1.0;";

        SignalRConnectionString.ExtractAccessKey(cs).Should().Be("lower");
    }
}
