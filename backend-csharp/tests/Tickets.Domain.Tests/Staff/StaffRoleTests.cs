using Tickets.Domain.Staff;
using Tickets.Domain.Staff.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Staff;

public sealed class StaffRoleTests
{
    [Fact]
    public void PromoteToAdmin_FromStaff_TransitionsAndRaisesEvent()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();

        staff.ChangeRole(StaffRole.Admin, clock);

        staff.Role.Should().Be(StaffRole.Admin);
        var evt = staff.DomainEvents.OfType<StaffRoleChanged>().Single();
        evt.From.Should().Be(StaffRole.Staff);
        evt.To.Should().Be(StaffRole.Admin);
    }

    [Fact]
    public void ChangeRole_ToSameRole_NoOp()
    {
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();
        var versionBefore = staff.Version;

        staff.ChangeRole(StaffRole.Staff, new FakeClock());

        staff.Version.Should().Be(versionBefore);
        staff.DomainEvents.Should().BeEmpty();
    }

    [Theory]
    [InlineData(StaffRole.Staff, StaffRole.Staff, true)]   // staff covers staff
    [InlineData(StaffRole.Admin, StaffRole.Staff, true)]   // admin covers staff
    [InlineData(StaffRole.Admin, StaffRole.Admin, true)]   // admin covers admin
    [InlineData(StaffRole.Staff, StaffRole.Admin, false)]  // staff does NOT cover admin
    public void HasAtLeast_RankComparison(StaffRole actual, StaffRole required, bool expected)
    {
        var staff = StaffTestData.ANewStaff();
        if (actual == StaffRole.Admin)
        {
            staff.ChangeRole(StaffRole.Admin, new FakeClock());
        }

        staff.HasAtLeast(required).Should().Be(expected);
    }
}
