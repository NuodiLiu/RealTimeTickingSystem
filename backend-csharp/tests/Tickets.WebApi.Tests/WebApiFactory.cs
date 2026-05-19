using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Testcontainers.PostgreSql;
using Tickets.Domain.Devices;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;

namespace Tickets.WebApi.Tests;

/// <summary>
/// Boots the real <c>Program</c> against an ephemeral Postgres container.
/// Tests use <see cref="CreateAuthenticatedClient"/> to bypass auth without
/// rewiring the JWT scheme — the helper signs a token with the same key
/// the WebApi was configured with.
/// </summary>
public sealed class WebApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string Issuer = "https://localhost/test-tickets";
    public const string Audience = "tickets-api";
    public const string SigningKey = "test-signing-key-must-be-at-least-32-bytes-long-xx";

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("tickets_webapi_test")
        .WithUsername("tickets")
        .WithPassword("tickets")
        .Build();

    public async Task InitializeAsync()
    {
        await _container.StartAsync().ConfigureAwait(false);

        // Environment variables are the only configuration source the
        // WebApplication.CreateBuilder() pipeline guarantees to read BEFORE
        // Program.cs's top-level code runs (ConfigureAppConfiguration is too
        // late — it fires during builder.Build()).
        Environment.SetEnvironmentVariable(
            "ConnectionStrings__TicketsDb", _container.GetConnectionString());
        Environment.SetEnvironmentVariable("AppJwt__Issuer", Issuer);
        Environment.SetEnvironmentVariable("AppJwt__Audience", Audience);
        Environment.SetEnvironmentVariable("AppJwt__SigningKey", SigningKey);

        // Run migrations against the ephemeral container before any HTTP test
        // hits the API.
        var options = new DbContextOptionsBuilder<TicketsDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .Options;
        await using var ctx = new TicketsDbContext(options);
        await ctx.Database.MigrateAsync().ConfigureAwait(false);
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync().ConfigureAwait(false);
        await _container.DisposeAsync().ConfigureAwait(false);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Test");
    }

    public HttpClient CreateAnonymousClient() => CreateClient();

    public HttpClient CreateAuthenticatedClient(StaffId? staffId = null, StaffRole role = StaffRole.Staff)
    {
        var client = CreateClient();
        var token = IssueToken(staffId ?? Domain.Staff.StaffId.New(), role);
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public static string IssueToken(StaffId staffId, StaffRole role)
    {
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
            SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var jwt = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: new[]
            {
                new Claim("sub", staffId.Value.ToString()),
                new Claim("role", role.ToString()),
            },
            notBefore: now,
            expires: now.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    /// <summary>
    /// Seeds a paired device directly into the test database and returns its
    /// id + plaintext secret. Mirrors what the real /pair/complete flow would
    /// produce so device-auth tests can authenticate without going through it.
    /// </summary>
    public async Task<(DeviceId deviceId, string plaintextSecret)> SeedPairedDeviceAsync(
        DeviceMode mode = DeviceMode.Feedback,
        string? name = null)
    {
        var plaintext = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        Span<byte> hashBytes = stackalloc byte[SHA256.HashSizeInBytes];
        SHA256.HashData(Encoding.UTF8.GetBytes(plaintext), hashBytes);
        var hash = SecretHash.FromRaw(Convert.ToHexString(hashBytes).ToLowerInvariant());

        var deviceName = DeviceName.Parse(name ?? $"Kiosk-{Guid.NewGuid():N}".Substring(0, 16));
        var clock = new FixedClock(DateTimeOffset.UtcNow);
        var device = KioskDevice.Pair(deviceName, hash, mode, clock);

        var options = new DbContextOptionsBuilder<TicketsDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .Options;
        await using var ctx = new TicketsDbContext(options);
        await new KioskDeviceRepository(ctx).AddAsync(device);
        await new UnitOfWork(ctx).CommitAsync();
        return (device.Id, plaintext);
    }

    public HttpClient CreateDeviceAuthenticatedClient(DeviceId deviceId, string plaintextSecret)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Device", $"{deviceId.Value}:{plaintextSecret}");
        return client;
    }

    private sealed class FixedClock(DateTimeOffset at) : IClock
    {
        public DateTimeOffset UtcNow { get; } = at;
    }
}

[CollectionDefinition("webapi")]
public sealed class WebApiCollection : ICollectionFixture<WebApiFactory>;
