using Tickets.Domain.Staff;
using Tickets.Domain.Staff.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Staff;

public sealed class StaffProvisionTests
{
    [Fact]
    public void Provision_NewStaff_ShouldStartAtVersion1WithStaffRole()
    {
        var clock = new FakeClock();

        var staff = Domain.Staff.Staff.Provision(
            StaffTestData.AnIdentityKey(),
            StaffTestData.AnEmail(),
            StaffTestData.AnEmployeeNo(),
            displayName: "Liam",
            clock);

        staff.Role.Should().Be(StaffRole.Staff);
        staff.Email.Should().Be(StaffTestData.AnEmail());
        staff.IdentityKey.Should().Be(StaffTestData.AnIdentityKey());
        staff.EmployeeNo.Should().Be(StaffTestData.AnEmployeeNo());
        staff.Name.Should().Be("Liam");
        staff.CreatedAt.Should().Be(clock.UtcNow);
        staff.Version.Should().Be(1);
    }

    [Fact]
    public void Provision_NewStaff_ShouldEmitStaffCreatedEvent()
    {
        var staff = StaffTestData.ANewStaff();

        staff.DomainEvents.Should().ContainSingle(e => e is StaffCreated);
        var created = staff.DomainEvents.OfType<StaffCreated>().Single();
        created.StaffId.Should().Be(staff.Id);
        created.Email.Should().Be(staff.Email);
        created.Role.Should().Be(StaffRole.Staff);
    }

    [Fact]
    public void Provision_AllowsNullDisplayName()
    {
        var staff = Domain.Staff.Staff.Provision(
            StaffTestData.AnIdentityKey(),
            StaffTestData.AnEmail(),
            StaffTestData.AnEmployeeNo(),
            displayName: null,
            new FakeClock());

        staff.Name.Should().BeNull();
    }

    [Fact]
    public void Provision_ClearDomainEvents_RemovesPendingEvents()
    {
        var staff = StaffTestData.ANewStaff();

        staff.ClearDomainEvents();

        staff.DomainEvents.Should().BeEmpty();
    }
}
