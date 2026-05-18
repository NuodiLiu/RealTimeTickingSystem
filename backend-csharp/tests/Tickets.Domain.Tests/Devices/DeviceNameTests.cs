using Tickets.Domain.Devices;

namespace Tickets.Domain.Tests.Devices;

public sealed class DeviceNameTests
{
    [Theory]
    [InlineData("Kiosk-01", "Kiosk-01")]
    [InlineData("  Kiosk  ", "Kiosk")]
    public void Parse_Trims(string raw, string expected)
    {
        DeviceName.Parse(raw).Value.Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Parse_BlankInput_Throws(string raw)
    {
        var act = () => DeviceName.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Parse_TooLong_Throws()
    {
        var raw = new string('a', DeviceName.MaxLength + 1);
        var act = () => DeviceName.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Parse_AtMaxLength_OK()
    {
        var raw = new string('a', DeviceName.MaxLength);
        DeviceName.Parse(raw).Value.Should().HaveLength(DeviceName.MaxLength);
    }
}
