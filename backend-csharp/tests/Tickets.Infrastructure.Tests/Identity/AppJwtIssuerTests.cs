using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Identity;

namespace Tickets.Infrastructure.Tests.Identity;

/// <summary>
/// Pure unit tests for <see cref="AppJwtIssuer"/> — no Docker needed.
/// Verifies the staff App-JWT claims, lifetime (driven by the injected
/// <see cref="IClock"/> and <see cref="AppJwtOptions.TokenTtl"/>), and the
/// missing-signing-key guard.
/// </summary>
public sealed class AppJwtIssuerTests
{
    private const string SigningKey = "unit-test-signing-key-must-be-32+bytes-long-xx";
    private const string Issuer = "https://localhost/tickets";
    private const string Audience = "tickets-api";

    private static readonly DateTimeOffset Now =
        new(2026, 6, 15, 12, 0, 0, TimeSpan.Zero);

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }

    private static AppJwtIssuer CreateIssuer(
        string signingKey = SigningKey,
        TimeSpan? tokenTtl = null)
    {
        var opts = Options.Create(new AppJwtOptions
        {
            Issuer = Issuer,
            Audience = Audience,
            SigningKey = signingKey,
            TokenTtl = tokenTtl ?? TimeSpan.FromHours(2),
        });
        return new AppJwtIssuer(opts, new FixedClock(Now));
    }

    [Fact]
    public void Issue_EmitsSubAndRoleClaims_AndIssuerAudience()
    {
        var issuer = CreateIssuer();
        var staffId = StaffId.New();

        var result = issuer.Issue(staffId, StaffRole.Admin);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        jwt.Claims.Should().Contain(c => c.Type == "sub" && c.Value == staffId.Value.ToString());
        jwt.Claims.Should().Contain(c => c.Type == "role" && c.Value == StaffRole.Admin.ToString());
        jwt.Issuer.Should().Be(Issuer);
        jwt.Audiences.Should().Contain(Audience);
    }

    [Fact]
    public void Issue_SetsExpireAtToNowPlusTokenTtl_UsingInjectedClock()
    {
        var ttl = TimeSpan.FromHours(3);
        var issuer = CreateIssuer(tokenTtl: ttl);

        var result = issuer.Issue(StaffId.New(), StaffRole.Staff);

        result.ExpireAt.Should().Be(Now + ttl);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        jwt.ValidTo.Should().BeCloseTo((Now + ttl).UtcDateTime, TimeSpan.FromSeconds(1));
        jwt.ValidFrom.Should().BeCloseTo(Now.UtcDateTime, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Issue_ProducesTokenThatValidatesWithSameKey()
    {
        var issuer = CreateIssuer();
        var staffId = StaffId.New();
        var result = issuer.Issue(staffId, StaffRole.Staff);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = Issuer,
            ValidateAudience = true,
            ValidAudience = Audience,
            ValidateLifetime = true,
            LifetimeValidator = (notBefore, expires, _, _) =>
                notBefore <= Now.UtcDateTime && Now.UtcDateTime < expires,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
            NameClaimType = "sub",
            RoleClaimType = "role",
        };

        // Mirror Program.cs JwtBearer config: keep 'sub'/'role' verbatim
        // instead of remapping them to the long XML-schema URIs.
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(result.Token, validationParameters, out _);

        principal.FindFirst("sub")!.Value.Should().Be(staffId.Value.ToString());
        principal.IsInRole(StaffRole.Staff.ToString()).Should().BeTrue();
    }

    [Fact]
    public void Issue_EmptySigningKey_Throws()
    {
        var issuer = CreateIssuer(signingKey: string.Empty);

        var act = () => issuer.Issue(StaffId.New(), StaffRole.Staff);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*SigningKey*");
    }
}
