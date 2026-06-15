using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Staff;

public sealed class StaffProfileUpdateTests
{
    [Fact]
    public void UpdateProfile_NoChange_DoesNotBumpVersionNorRaiseEvent()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();
        var versionBefore = staff.Version;

        staff.UpdateProfile(name: staff.Name, email: staff.Email, clock);

        staff.Version.Should().Be(versionBefore);
        staff.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void UpdateProfile_NameOnly_RaisesProfileUpdatedAndBumpsVersion()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();
        var versionBefore = staff.Version;

        staff.UpdateProfile(name: "Liam Liu", email: staff.Email, clock);

        staff.Name.Should().Be("Liam Liu");
        staff.Version.Should().Be(versionBefore + 1);
        staff.DomainEvents.Should().ContainSingle(e => e is StaffProfileUpdated);
    }

    [Fact]
    public void UpdateProfile_EmailOnly_RaisesProfileUpdated()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();
        var newEmail = EmailAddress.Parse("liam.l@example.com");

        staff.UpdateProfile(name: staff.Name, email: newEmail, clock);

        staff.Email.Should().Be(newEmail);
        staff.DomainEvents.OfType<StaffProfileUpdated>().Single().NewEmail.Should().Be(newEmail);
    }

    [Fact]
    public void UpdateProfile_BothChanged_SingleEventCarriesBoth()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();

        var newEmail = EmailAddress.Parse("new@example.com");
        staff.UpdateProfile(name: "Renamed", email: newEmail, clock);

        var evt = staff.DomainEvents.OfType<StaffProfileUpdated>().Single();
        evt.NewName.Should().Be("Renamed");
        evt.NewEmail.Should().Be(newEmail);
    }

    [Fact]
    public void UpdateProfile_NullName_AllowedAsClearing()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff(name: "Liam");
        staff.ClearDomainEvents();

        staff.UpdateProfile(name: null, email: staff.Email, clock);

        staff.Name.Should().BeNull();
        staff.DomainEvents.Should().ContainSingle();
    }
}
