using Tickets.Domain.Cases;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// Dev-only seed endpoint that provisions a baseline dataset for manual UI
/// testing: an admin staff record plus a handful of queued cases.
/// Mapped only when <c>ASPNETCORE_ENVIRONMENT=Development</c>.
/// </summary>
public static class DevSeedEndpoints
{
    public static IEndpointRouteBuilder MapDevSeedEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/dev/seed").WithTags("Dev");

        group.MapPost("/", async (
            IStaffRepository staffRepo,
            ICaseRepository caseRepo,
            IUnitOfWork uow,
            IClock clock,
            CancellationToken ct) =>
        {
            var seeded = new List<object>();

            // Admin staff
            var adminEmail = EmailAddress.Parse("admin@dev.local");
            var admin = await staffRepo.FindByEmailAsync(adminEmail, ct);
            if (admin is null)
            {
                var tid = "dev-tenant";
                var oid = "devadmin-00000001";
                admin = Staff.Provision(
                    IdentityKey.FromAzureAd(tid, oid),
                    adminEmail,
                    EmployeeNo.ForAzureAd(tid, oid + "00000000"),
                    displayName: "Dev Admin",
                    clock);
                admin.ChangeRole(StaffRole.Admin, clock);
                await staffRepo.AddAsync(admin, ct);
            }
            seeded.Add(new { kind = "staff", id = admin.Id.Value, email = admin.Email.Value, role = admin.Role.ToString() });

            // Three queued cases
            var samples = new (string Name, string Category, string? ZId)[]
            {
                ("Alice Chen", "Registration", "z1234567"),
                ("Bob Liu", "ID Card", null),
                ("Carol Wang", "Account Issue", "z7654321"),
            };
            foreach (var s in samples)
            {
                var c = Case.Queue(
                    StudentName.Parse(s.Name),
                    Category.Parse(s.Category),
                    s.ZId is null ? null : ZId.Parse(s.ZId),
                    createdByDeviceId: null,
                    clock);
                await caseRepo.AddAsync(c, ct);
                seeded.Add(new { kind = "case", id = c.Id.Value, name = s.Name, category = s.Category, status = c.Status.ToString() });
            }

            await uow.CommitAsync(ct);

            return Results.Json(new { ok = true, seeded });
        }).AllowAnonymous();

        return app;
    }
}
