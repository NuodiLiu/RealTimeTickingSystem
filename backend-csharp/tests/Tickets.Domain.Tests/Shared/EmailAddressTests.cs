using Tickets.Domain.Shared.ValueObjects;

namespace Tickets.Domain.Tests.Shared;

public sealed class EmailAddressTests
{
    [Theory]
    [InlineData("liam@example.com", "liam@example.com")]
    [InlineData("  Liam@Example.COM  ", "liam@example.com")]
    [InlineData("LIAM@EXAMPLE.COM", "liam@example.com")]
    public void Parse_NormalizesTrimAndLowercase(string raw, string expected)
    {
        EmailAddress.Parse(raw).Value.Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Parse_BlankInput_Throws(string? raw)
    {
        var act = () => EmailAddress.Parse(raw!);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("no-at-sign")]
    [InlineData("@nolocal.com")]
    [InlineData("nodomain@")]
    [InlineData("missing-dot@example")]
    public void Parse_MalformedInput_Throws(string raw)
    {
        var act = () => EmailAddress.Parse(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void TryParse_GoodInput_ReturnsTrueWithValue()
    {
        EmailAddress.TryParse("liam@example.com", out var email).Should().BeTrue();
        email.Value.Should().Be("liam@example.com");
    }

    [Fact]
    public void TryParse_BadInput_ReturnsFalseWithDefault()
    {
        EmailAddress.TryParse("not-an-email", out var email).Should().BeFalse();
        email.Should().Be(default(EmailAddress));
    }

    [Fact]
    public void Equality_IsValueBased()
    {
        var a = EmailAddress.Parse("liam@example.com");
        var b = EmailAddress.Parse("LIAM@example.com");
        a.Should().Be(b);
    }
}
