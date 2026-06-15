using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;
using Tickets.Domain.Tests.Shared;

namespace Tickets.Domain.Tests.Staff;

/// <summary>
/// Object Mother for <see cref="Staff"/> — AGENTS.md §5.5.
/// Tests never call the constructor directly.
/// </summary>
internal static class StaffTestData
{
    public const string TenantId = "11111111-1111-1111-1111-111111111111";
    public const string ObjectId = "22222222-2222-2222-2222-222222222222";
    public const string Email = "liam@example.com";

    public static IdentityKey AnIdentityKey(string? oid = null) =>
        IdentityKey.FromAzureAd(TenantId, oid ?? ObjectId);

    public static EmployeeNo AnEmployeeNo(string? oid = null) =>
        EmployeeNo.ForAzureAd(TenantId, oid ?? ObjectId);

    public static EmailAddress AnEmail(string? raw = null) =>
        EmailAddress.Parse(raw ?? Email);

    public static IClock AClock() => new FakeClock();

    public static Domain.Staff.Staff ANewStaff(string? oid = null, string? email = null, string? name = "Liam") =>
        Domain.Staff.Staff.Provision(
            AnIdentityKey(oid),
            AnEmail(email),
            AnEmployeeNo(oid),
            displayName: name,
            AClock());
}
