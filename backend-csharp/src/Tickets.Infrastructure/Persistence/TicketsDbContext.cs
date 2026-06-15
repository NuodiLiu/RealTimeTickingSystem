using Microsoft.EntityFrameworkCore;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence.Entities;

namespace Tickets.Infrastructure.Persistence;

/// <summary>
/// Single EF Core context for the whole solution. One context per request
/// (scoped) — UnitOfWork wraps its <see cref="DbContext.SaveChangesAsync(CancellationToken)"/>.
/// </summary>
public sealed class TicketsDbContext(DbContextOptions<TicketsDbContext> options) : DbContext(options)
{
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Case> Cases => Set<Case>();
    public DbSet<KioskDevice> Devices => Set<KioskDevice>();
    public DbSet<FeedbackSession> FeedbackSessions => Set<FeedbackSession>();

    // Infrastructure-only ledgers (not domain aggregates). The entity types are
    // internal, so these accessors are internal too. See Persistence/Entities
    // and the matching IEntityTypeConfiguration types.
    internal DbSet<PairingTokenEntry> PairingTokens => Set<PairingTokenEntry>();
    internal DbSet<RefreshHandleEntry> RefreshHandles => Set<RefreshHandleEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema("public");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TicketsDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
