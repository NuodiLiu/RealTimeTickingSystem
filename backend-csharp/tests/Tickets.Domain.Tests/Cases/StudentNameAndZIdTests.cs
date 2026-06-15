using Tickets.Domain.Cases;

namespace Tickets.Domain.Tests.Cases;

public sealed class StudentNameAndZIdTests
{
    [Fact]
    public void StudentName_Parse_Trims()
    {
        StudentName.Parse("  Liam Liu  ").Value.Should().Be("Liam Liu");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void StudentName_BlankInput_Throws(string raw)
    {
        var act = () => StudentName.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void StudentName_TooLong_Throws()
    {
        var act = () => StudentName.Parse(new string('a', StudentName.MaxLength + 1));
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("z1234567", "z1234567")]
    [InlineData("Z1234567", "z1234567")]
    [InlineData("  z123456  ", "z123456")]
    [InlineData("z12345678", "z12345678")]
    public void ZId_ParsesAndNormalizes(string raw, string expected)
    {
        ZId.Parse(raw).Value.Should().Be(expected);
    }

    [Theory]
    [InlineData("123456")]      // no z
    [InlineData("z12345")]      // too short
    [InlineData("z123456789")]  // too long
    [InlineData("za1234567")]   // non-digit
    [InlineData("")]            // empty
    public void ZId_Invalid_Throws(string raw)
    {
        var act = () => ZId.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ZId_TryParse_BadInput_ReturnsFalse()
    {
        ZId.TryParse("not-a-zid", out var z).Should().BeFalse();
        z.Should().Be(default(ZId));
    }

    [Fact]
    public void ZId_TryParse_NullOrEmpty_ReturnsFalse()
    {
        ZId.TryParse(null, out _).Should().BeFalse();
        ZId.TryParse("", out _).Should().BeFalse();
    }
}
