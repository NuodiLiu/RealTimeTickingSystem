using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Persistence;

/// <summary>
/// Single EF Core context for the whole solution. One context per request
/// (scoped) — UnitOfWork wraps its <see cref="DbContext.SaveChangesAsync(CancellationToken)"/>.
/// </summary>
public sealed class TicketsDbContext(DbContextOptions<TicketsDbContext> options) : DbContext(options)
{
    public DbSet<Staff> Staff => Set<Staff>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        // Snake-case all default-named columns for Postgres convention.
        modelBuilder.HasDefaultSchema("public");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TicketsDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
