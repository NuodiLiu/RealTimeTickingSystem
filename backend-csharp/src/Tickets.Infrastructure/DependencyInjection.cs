using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tickets.Application.Abstractions;
using Tickets.Application.Devices.Configuration;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;
using Tickets.Domain.FeedbackSessions;
using Tickets.Domain.Shared.Abstractions;
using Tickets.Domain.Shared.Time;
using Tickets.Domain.Staff;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Pairing.Abstractions;
using Tickets.Application.Reporting.Abstractions;
using Tickets.Infrastructure.Devices;
using Tickets.Infrastructure.Events;
using Tickets.Infrastructure.Identity;
using Tickets.Infrastructure.Notifications;
using Tickets.Infrastructure.Pairing;
using Tickets.Infrastructure.Persistence;
using Tickets.Infrastructure.Persistence.Repositories;
using Tickets.Infrastructure.Reporting;
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

        // Notification gateway.
        // FakeNotificationGateway is always registered as a concrete singleton
        // (the dev /dev/notifications endpoint and infrastructure tests new it
        // up via DI). The INotificationGateway *binding* points at the Azure
        // SignalR gateway only when a connection string is configured; with no
        // connection string (e.g. the WebApiFactory integration tests, local
        // dev without Azure) it falls back to the fake — keeping tests green.
        var signalRConnectionString =
            configuration.GetSection(AzureSignalROptions.SectionName)["ConnectionString"]
            ?? configuration["AZURE_SIGNALR_CONNECTION_STRING"];

        services.AddOptions<AzureSignalROptions>()
            .Bind(configuration.GetSection(AzureSignalROptions.SectionName))
            .PostConfigure(o =>
            {
                // Accept the AZURE_SIGNALR_CONNECTION_STRING env var as a
                // fallback when the structured Azure:SignalR:ConnectionString
                // section is empty.
                if (string.IsNullOrWhiteSpace(o.ConnectionString))
                {
                    o.ConnectionString =
                        configuration["AZURE_SIGNALR_CONNECTION_STRING"] ?? string.Empty;
                }
            });

        services.AddSingleton<FakeNotificationGateway>();

        if (!string.IsNullOrWhiteSpace(signalRConnectionString))
        {
            services.AddSingleton<AzureSignalRNotificationGateway>();
            services.AddSingleton<INotificationGateway>(
                sp => sp.GetRequiredService<AzureSignalRNotificationGateway>());
        }
        else
        {
            services.AddSingleton<INotificationGateway>(
                sp => sp.GetRequiredService<FakeNotificationGateway>());
        }

        // Pairing — cryptographic generators + Postgres-backed token ledger.
        // PostgresPairingTokenStore MUST be Scoped: it shares the scoped
        // TicketsDbContext.
        services.AddSingleton<IPairingTokenGenerator, CryptoPairingTokenGenerator>();
        services.AddScoped<IPairingTokenStore, PostgresPairingTokenStore>();
        services.AddSingleton<IDeviceSecretGenerator, CryptoDeviceSecretGenerator>();
        // Phase 5: real signed HS256 device WebSocket tokens (was
        // PlaceholderDeviceTokenIssuer). Binds AppJwtOptions below, so register
        // after the options bind is not required — IOptions is resolved lazily.
        services.AddSingleton<IDeviceTokenIssuer, JwtDeviceTokenIssuer>();

        // Auth — App-JWT issuance + Postgres-backed refresh-handle ledger.
        // PostgresRefreshHandleStore MUST be Scoped: it shares the scoped
        // TicketsDbContext.
        services.AddOptions<AppJwtOptions>()
            .Bind(configuration.GetSection(AppJwtOptions.SectionName));
        services.AddSingleton<IAppJwtIssuer, AppJwtIssuer>();
        services.AddScoped<IRefreshHandleStore, PostgresRefreshHandleStore>();

        // Reporting — ClosedXML xlsx generator.
        services.AddSingleton<IExcelWorkbookGenerator, ClosedXmlWorkbookGenerator>();

        // Device online-monitoring.
        services.AddOptions<DeviceConnectivityOptions>()
            .Bind(configuration.GetSection(DeviceConnectivityOptions.SectionName));
        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();
        services.AddHostedService<DeviceConnectivitySweeperService>();

        return services;
    }
}
