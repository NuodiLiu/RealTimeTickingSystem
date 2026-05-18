using Tickets.Domain.Staff;

namespace Tickets.Domain.Tests.Staff;

public sealed class IdentityKeyTests
{
    [Fact]
    public void FromAzureAd_BuildsCanonicalFormat()
    {
        var key = IdentityKey.FromAzureAd("tid-1", "oid-1");
        key.Value.Should().Be("aad:tid-1:oid-1");
    }

    [Theory]
    [InlineData("", "oid")]
    [InlineData("tid", "")]
    [InlineData("   ", "oid")]
    public void FromAzureAd_BlankParts_Throws(string tid, string oid)
    {
        var act = () => IdentityKey.FromAzureAd(tid, oid);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void FromRaw_AcceptsCanonical()
    {
        IdentityKey.FromRaw("aad:tid:oid").Value.Should().Be("aad:tid:oid");
    }

    [Theory]
    [InlineData("microsoft:tid:oid")]
    [InlineData("tid:oid")]
    [InlineData("aad")]
    public void FromRaw_NonAadPrefix_Throws(string raw)
    {
        var act = () => IdentityKey.FromRaw(raw);
        act.Should().Throw<ArgumentException>();
    }
}
