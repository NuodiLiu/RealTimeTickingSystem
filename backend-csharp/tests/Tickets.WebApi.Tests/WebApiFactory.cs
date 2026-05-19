using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Testcontainers.PostgreSql;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;

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
}

[CollectionDefinition("webapi")]
public sealed class WebApiCollection : ICollectionFixture<WebApiFactory>;
