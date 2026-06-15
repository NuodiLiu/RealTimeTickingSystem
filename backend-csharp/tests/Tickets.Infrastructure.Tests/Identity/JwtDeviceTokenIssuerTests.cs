using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tickets.Application.Auth.Abstractions;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;
using Tickets.Infrastructure.Pairing;

namespace Tickets.Infrastructure.Tests.Identity;

/// <summary>
/// Pure unit tests for <see cref="JwtDeviceTokenIssuer"/> — no Docker needed,
/// so these run locally. Verifies the emitted device JWT carries the contract
/// claims, is signed with the configured key, and that validation passes with
/// the same parameters the JwtBearer middleware uses.
/// </summary>
public sealed class JwtDeviceTokenIssuerTests
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

    private static JwtDeviceTokenIssuer CreateIssuer(string signingKey = SigningKey)
    {
        var opts = Options.Create(new AppJwtOptions
        {
            Issuer = Issuer,
            Audience = Audience,
            SigningKey = signingKey,
        });
        return new JwtDeviceTokenIssuer(opts, new FixedClock(Now));
    }

    [Fact]
    public void IssueWebsocketToken_EmitsSubDeviceIdAndModeClaims()
    {
        var issuer = CreateIssuer();
        var deviceId = DeviceId.New();

        var token = issuer.IssueWebsocketToken(deviceId, DeviceMode.Feedback, TimeSpan.FromMinutes(30));

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Type == "sub" && c.Value == deviceId.Value.ToString());
        jwt.Claims.Should().Contain(c => c.Type == "device_id" && c.Value == deviceId.Value.ToString());
        jwt.Claims.Should().Contain(c => c.Type == "mode" && c.Value == DeviceMode.Feedback.ToString());
        jwt.Issuer.Should().Be(Issuer);
        jwt.Audiences.Should().Contain(Audience);
    }

    [Fact]
    public void IssueWebsocketToken_SetsExpiryToNowPlusTtl_UsingInjectedClock()
    {
        var issuer = CreateIssuer();
        var ttl = TimeSpan.FromMinutes(45);

        var token = issuer.IssueWebsocketToken(DeviceId.New(), DeviceMode.Registration, ttl);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        // JWT exp/nbf are second-precision; compare with a tolerance.
        jwt.ValidTo.Should().BeCloseTo((Now + ttl).UtcDateTime, TimeSpan.FromSeconds(1));
        jwt.ValidFrom.Should().BeCloseTo(Now.UtcDateTime, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void IssueWebsocketToken_ProducesTokenThatValidatesWithSameParameters()
    {
        var issuer = CreateIssuer();
        var deviceId = DeviceId.New();
        var token = issuer.IssueWebsocketToken(deviceId, DeviceMode.Feedback, TimeSpan.FromMinutes(30));

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = Issuer,
            ValidateAudience = true,
            ValidAudience = Audience,
            ValidateLifetime = true,
            // Validate against the issuer's fixed clock so the token (issued at
            // Now) is not seen as expired relative to the real wall clock.
            LifetimeValidator = (notBefore, expires, _, _) =>
                notBefore <= Now.UtcDateTime && Now.UtcDateTime < expires,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
        };

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(token, validationParameters, out var validatedToken);

        principal.Should().NotBeNull();
        validatedToken.Should().BeOfType<JwtSecurityToken>();
        principal.FindFirst("device_id")!.Value.Should().Be(deviceId.Value.ToString());
    }

    [Fact]
    public void IssueWebsocketToken_WrongKey_FailsValidation()
    {
        var issuer = CreateIssuer();
        var token = issuer.IssueWebsocketToken(DeviceId.New(), DeviceMode.Feedback, TimeSpan.FromMinutes(30));

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes("a-completely-different-signing-key-32bytes")),
        };

        var act = () => new JwtSecurityTokenHandler()
            .ValidateToken(token, validationParameters, out _);

        act.Should().Throw<SecurityTokenInvalidSignatureException>();
    }

    [Fact]
    public void IssueWebsocketToken_EmptySigningKey_Throws()
    {
        var issuer = CreateIssuer(signingKey: string.Empty);

        var act = () => issuer.IssueWebsocketToken(DeviceId.New(), DeviceMode.Feedback, TimeSpan.FromMinutes(30));

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*SigningKey*");
    }
}
