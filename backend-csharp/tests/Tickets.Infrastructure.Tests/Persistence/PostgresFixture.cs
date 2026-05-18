using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Tickets.Infrastructure.Persistence;

namespace Tickets.Infrastructure.Tests.Persistence;

/// <summary>
/// One ephemeral Postgres container per test class (see usage with
/// <c>IClassFixture&lt;PostgresFixture&gt;</c>). The schema is created with
/// <see cref="DatabaseFacade.EnsureCreatedAsync"/>; once we add a Migrations
/// directory we'll switch to <see cref="RelationalDatabaseFacadeExtensions.MigrateAsync"/>.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("tickets_test")
        .WithUsername("tickets")
        .WithPassword("tickets")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync().ConfigureAwait(false);

        var options = new DbContextOptionsBuilder<TicketsDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        await using var ctx = new TicketsDbContext(options);
        await ctx.Database.EnsureCreatedAsync().ConfigureAwait(false);
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Creates a fresh <see cref="TicketsDbContext"/> bound to this container.
    /// Each test that wants isolation should create one of these inside an
    /// async-disposing scope.
    /// </summary>
    public TicketsDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TicketsDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        return new TicketsDbContext(options);
    }
}

/// <summary>
/// Shares the Postgres container across every test class that opts in via
/// <c>[Collection("postgres")]</c>. Spinning up the container is multi-second,
/// so we pay it once per test run.
/// </summary>
[CollectionDefinition("postgres")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>;
