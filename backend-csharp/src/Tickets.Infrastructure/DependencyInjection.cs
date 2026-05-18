using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;
using Tickets.Infrastructure.Time;

namespace Tickets.Infrastructure;

/// <summary>
/// Wires infrastructure-bound services. WebApi composition root calls
/// <c>services.AddInfrastructure(configuration)</c> after
/// <c>services.AddApplication()</c>.
/// </summary>
public static class DependencyInjection
{
    public const string ConnectionStringName = "TicketsDb";

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is not configured.");

        services.AddDbContext<TicketsDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IStaffRepository, StaffRepository>();

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IClock, SystemClock>();

        return services;
    }
}
