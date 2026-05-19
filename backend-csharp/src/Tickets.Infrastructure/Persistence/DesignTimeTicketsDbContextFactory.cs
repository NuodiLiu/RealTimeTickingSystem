using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Tickets.Infrastructure.Persistence;

/// <summary>
/// Lets <c>dotnet ef</c> tooling materialise a <see cref="TicketsDbContext"/>
/// without needing a real connection. The connection string here is a stub —
/// migrations only need to inspect the model, not connect.
/// <para>
/// Usage:
/// <code>
///   dotnet ef migrations add &lt;Name&gt; \
///       --project src/Tickets.Infrastructure \
///       --startup-project src/Tickets.Infrastructure
/// </code>
/// </para>
/// </summary>
internal sealed class DesignTimeTicketsDbContextFactory : IDesignTimeDbContextFactory<TicketsDbContext>
{
    public TicketsDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<TicketsDbContext>()
            .UseNpgsql("Host=localhost;Database=tickets;Username=tickets;Password=tickets");
        return new TicketsDbContext(builder.Options);
    }
}
