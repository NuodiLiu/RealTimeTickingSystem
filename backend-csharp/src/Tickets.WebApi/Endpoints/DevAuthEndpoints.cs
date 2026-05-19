using Microsoft.Extensions.Options;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Shared.ValueObjects;
using Tickets.Domain.Staff;

namespace Tickets.WebApi.Endpoints;

/// <summary>
/// Dev-only login that bypasses Azure AD. Mints an App-JWT for an arbitrary
/// staff record (creating it on first use) and sets the refresh cookie.
/// Mapped only when <c>ASPNETCORE_ENVIRONMENT=Development</c>.
/// <para>
/// Phase 5 replaces this with the real <c>/auth/login</c> → Azure AD →
/// <c>/auth/redirect</c> flow.
/// </para>
/// </summary>
public static class DevAuthEndpoints
{
    public static IEndpointRouteBuilder MapDevAuthEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/auth").WithTags("Dev");

        group.MapPost("/dev-login", async (
            DevLoginBody body,
            IStaffRepository staffRepo,
            IRefreshHandleStore handleStore,
            IAppJwtIssuer jwtIssuer,
            Domain.Shared.Abstractions.IUnitOfWork uow,
            IClock clock,
            IOptions<AppJwtOptions> opts,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            ArgumentNullException.ThrowIfNull(body);
            if (string.IsNullOrWhiteSpace(body.Email))
            {
                return Results.Json(new
                {
                    error = "invalid_request",
                    error_description = "email is required",
                }, statusCode: 400);
            }

            var email = EmailAddress.Parse(body.Email);
            var existing = await staffRepo.FindByEmailAsync(email, ct);

            Staff staff;
            if (existing is null)
            {
                var tid = "dev-tenant";
                var oid = $"devuser-{body.Email.GetHashCode():x8}";
                staff = Staff.Provision(
                    IdentityKey.FromAzureAd(tid, oid),
                    email,
                    EmployeeNo.ForAzureAd(tid, oid + "00000000"),
                    displayName: body.Name ?? body.Email,
                    clock);
                await staffRepo.AddAsync(staff, ct);
                await uow.CommitAsync(ct);

                if (body.AsAdmin == true)
                {
                    staff.ChangeRole(StaffRole.Admin, clock);
                    await uow.CommitAsync(ct);
                }
            }
            else
            {
                staff = existing;
                if (body.AsAdmin == true && staff.Role != StaffRole.Admin)
                {
                    staff.ChangeRole(StaffRole.Admin, clock);
                    await uow.CommitAsync(ct);
                }
            }

            var jwt = jwtIssuer.Issue(staff.Id, staff.Role);
            var refreshExpireAt = clock.UtcNow + opts.Value.RefreshTtl;
            var refreshHandle = await handleStore.IssueAsync(staff.Id, refreshExpireAt, ct);

            // Mirror AuthEndpoints cookie config so /auth/refresh works after.
            httpContext.Response.Cookies.Append(
                AuthEndpoints.RefreshCookieName,
                refreshHandle,
                new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Path = "/",
                    Expires = refreshExpireAt,
                    IsEssential = true,
                });

            return Results.Json(new
            {
                accessToken = jwt.Token,
                expireAt = jwt.ExpireAt,
                user = new
                {
                    id = staff.Id.Value,
                    role = staff.Role.ToString(),
                    employeeNo = staff.EmployeeNo.Value,
                    name = staff.Name,
                    email = staff.Email.Value,
                    identityKey = staff.IdentityKey.Value,
                },
            });
        }).AllowAnonymous();

        return app;
    }

    public sealed record DevLoginBody(string Email, string? Name, bool? AsAdmin);
}
