using Tickets.Domain.Staff;
using Tickets.Domain.Staff.Events;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Staff;

public sealed class StaffIdentityMigrationTests
{
    [Fact]
    public void MigrateIdentity_NewKey_UpdatesKeyAndRaisesEvent()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();
        var oldKey = staff.IdentityKey;
        var newKey = IdentityKey.FromAzureAd(
            "33333333-3333-3333-3333-333333333333",
            "44444444-4444-4444-4444-444444444444");
        var versionBefore = staff.Version;

        staff.MigrateIdentity(newKey, clock);

        staff.IdentityKey.Should().Be(newKey);
        staff.Version.Should().Be(versionBefore + 1);
        var evt = staff.DomainEvents.OfType<StaffIdentityMigrated>().Single();
        evt.OldIdentityKey.Should().Be(oldKey);
        evt.NewIdentityKey.Should().Be(newKey);
    }

    [Fact]
    public void MigrateIdentity_SameKey_NoOp()
    {
        var clock = new FakeClock();
        var staff = StaffTestData.ANewStaff();
        staff.ClearDomainEvents();
        var versionBefore = staff.Version;

        staff.MigrateIdentity(staff.IdentityKey, clock);

        staff.Version.Should().Be(versionBefore);
        staff.DomainEvents.Should().BeEmpty();
    }
}
