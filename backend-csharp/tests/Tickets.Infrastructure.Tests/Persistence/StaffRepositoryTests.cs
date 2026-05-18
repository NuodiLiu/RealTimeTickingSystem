using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Shared.Errors;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;

namespace Tickets.Infrastructure.Tests.Persistence;

[Collection("postgres")]
public sealed class StaffRepositoryTests(PostgresFixture fixture)
{
    private const string Tid = "11111111-1111-1111-1111-111111111111";

    private static Staff AStaff(string oid = "22222222-2222-2222-2222-222222222222")
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 5, 18, 12, 0, 0, TimeSpan.Zero));
        return Staff.Provision(
            IdentityKey.FromAzureAd(Tid, oid),
            EmailAddress.Parse($"user-{oid[..8]}@example.com"),
            EmployeeNo.ForAzureAd(Tid, oid),
            displayName: "Liam",
            clock);
    }

    [Fact]
    public async Task Add_ThenFindById_RoundTripsAllFields()
    {
        await using var ctx = fixture.CreateContext();
        var repo = new StaffRepository(ctx);
        var uow = new UnitOfWork(ctx);

        var staff = AStaff(oid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        await repo.AddAsync(staff);
        await uow.CommitAsync();

        await using var verifyCtx = fixture.CreateContext();
        var loaded = await new StaffRepository(verifyCtx).FindByIdAsync(staff.Id);

        loaded.Should().NotBeNull();
        loaded!.Id.Should().Be(staff.Id);
        loaded.IdentityKey.Should().Be(staff.IdentityKey);
        loaded.Email.Should().Be(staff.Email);
        loaded.EmployeeNo.Should().Be(staff.EmployeeNo);
        loaded.Role.Should().Be(staff.Role);
        loaded.Name.Should().Be(staff.Name);
        loaded.CreatedAt.Should().BeCloseTo(staff.CreatedAt, TimeSpan.FromMilliseconds(1));
        loaded.Version.Should().Be(staff.Version);
    }

    [Fact]
    public async Task FindByIdentityKey_ReturnsExistingRecord()
    {
        await using var ctx = fixture.CreateContext();
        var staff = AStaff(oid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        await new StaffRepository(ctx).AddAsync(staff);
        await new UnitOfWork(ctx).CommitAsync();

        await using var ctx2 = fixture.CreateContext();
        var found = await new StaffRepository(ctx2).FindByIdentityKeyAsync(staff.IdentityKey);

        found.Should().NotBeNull();
        found!.Id.Should().Be(staff.Id);
    }

    [Fact]
    public async Task FindByEmail_ReturnsExistingRecord()
    {
        await using var ctx = fixture.CreateContext();
        var staff = AStaff(oid: "cccccccc-cccc-cccc-cccc-cccccccccccc");
        await new StaffRepository(ctx).AddAsync(staff);
        await new UnitOfWork(ctx).CommitAsync();

        await using var ctx2 = fixture.CreateContext();
        var found = await new StaffRepository(ctx2).FindByEmailAsync(staff.Email);

        found.Should().NotBeNull();
        found!.Email.Should().Be(staff.Email);
    }

    [Fact]
    public async Task IdentityKey_IsUnique()
    {
        await using var ctx = fixture.CreateContext();
        var a = AStaff(oid: "dddddddd-dddd-dddd-dddd-dddddddddddd");
        var b = AStaff(oid: "dddddddd-dddd-dddd-dddd-dddddddddddd"); // same identityKey

        await new StaffRepository(ctx).AddAsync(a);
        await new UnitOfWork(ctx).CommitAsync();

        await using var ctx2 = fixture.CreateContext();
        await new StaffRepository(ctx2).AddAsync(b);

        Func<Task> act = async () => await new UnitOfWork(ctx2).CommitAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    /// <summary>
    /// AGENTS.md §9.2 — the <c>Version</c> column is an EF concurrency token.
    /// Two writers loading the same row and racing each other must end with
    /// one success and one <see cref="ConcurrencyError"/>.
    /// </summary>
    [Fact]
    public async Task ConcurrentUpdate_RaisesConcurrencyError()
    {
        var staffId = await SeedStaffAsync(oid: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

        await using var ctxA = fixture.CreateContext();
        await using var ctxB = fixture.CreateContext();
        var staffA = await new StaffRepository(ctxA).FindByIdAsync(staffId);
        var staffB = await new StaffRepository(ctxB).FindByIdAsync(staffId);
        staffA.Should().NotBeNull();
        staffB.Should().NotBeNull();

        var clock = new FixedClock(new DateTimeOffset(2026, 5, 19, 0, 0, 0, TimeSpan.Zero));
        staffA!.UpdateProfile("First Writer", staffA.Email, clock);
        staffB!.UpdateProfile("Second Writer", staffB.Email, clock);

        await new UnitOfWork(ctxA).CommitAsync();   // wins

        Func<Task> race = async () => await new UnitOfWork(ctxB).CommitAsync();
        var ex = await race.Should().ThrowAsync<ConcurrencyError>();
        ex.Which.AggregateName.Should().Be(nameof(Staff));
    }

    private async Task<StaffId> SeedStaffAsync(string oid)
    {
        await using var ctx = fixture.CreateContext();
        var staff = AStaff(oid: oid);
        await new StaffRepository(ctx).AddAsync(staff);
        await new UnitOfWork(ctx).CommitAsync();
        return staff.Id;
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }
}
