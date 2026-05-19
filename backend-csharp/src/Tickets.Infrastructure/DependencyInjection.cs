using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tickets.Application.Abstractions;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Infrastructure.Notifications;
using Tickets.Infrastructure.Pairing;
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
        services.AddScoped<ICaseRepository, CaseRepository>();
        services.AddScoped<IKioskDeviceRepository, KioskDeviceRepository>();
        services.AddScoped<IFeedbackSessionRepository, FeedbackSessionRepository>();

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IClock, SystemClock>();

        // Notification gateway — fake until Phase 5 wires Azure SignalR.
        services.AddSingleton<FakeNotificationGateway>();
        services.AddSingleton<INotificationGateway>(sp => sp.GetRequiredService<FakeNotificationGateway>());

        // Pairing — minimal cryptographic / in-memory implementations.
        // Phase 5 should replace InMemoryPairingTokenStore with a
        // Postgres-backed store and PlaceholderDeviceTokenIssuer with a
        // proper signed-JWT issuer.
        services.AddSingleton<IPairingTokenGenerator, CryptoPairingTokenGenerator>();
        services.AddSingleton<IPairingTokenStore, InMemoryPairingTokenStore>();
        services.AddSingleton<IDeviceSecretGenerator, CryptoDeviceSecretGenerator>();
        services.AddSingleton<IDeviceTokenIssuer, PlaceholderDeviceTokenIssuer>();

        return services;
    }
}
