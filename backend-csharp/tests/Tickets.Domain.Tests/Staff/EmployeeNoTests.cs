using Tickets.Domain.Staff;

namespace Tickets.Domain.Tests.Staff;

public sealed class EmployeeNoTests
{
    [Fact]
    public void ForAzureAd_TakesFirstEightCharsOfObjectId()
    {
        var no = EmployeeNo.ForAzureAd(
            tenantId: "11111111-1111-1111-1111-111111111111",
            objectId: "abcdefgh-ijkl-mnop-qrst-uvwxyz123456");

        no.Value.Should().Be("aad-11111111-1111-1111-1111-111111111111-abcdefgh");
    }

    [Fact]
    public void ForAzureAd_ObjectIdTooShort_Throws()
    {
        var act = () => EmployeeNo.ForAzureAd("tid", "short");
        act.Should().Throw<ArgumentException>();
    }
}
