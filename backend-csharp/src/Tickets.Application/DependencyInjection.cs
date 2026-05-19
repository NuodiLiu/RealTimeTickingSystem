using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Tickets.Application.Auth.Handlers;
using Tickets.Application.Cases.Handlers;
using Tickets.Application.Devices.Handlers;
using Tickets.Application.Feedback.Handlers;
using Tickets.Application.Pairing.Handlers;
using Tickets.Application.Reporting.Handlers;
using Tickets.Application.SignalR.Handlers;

namespace Tickets.Application;

/// <summary>
/// Registers Application-layer services with the DI container. WebApi
/// composition root calls <c>services.AddApplication()</c>.
/// <para>
/// Infrastructure-bound abstractions (<c>INotificationGateway</c>,
/// <c>ICurrentUser</c>, <c>ICurrentDevice</c>, repositories, <c>IClock</c>,
/// <c>IUnitOfWork</c>) are registered separately by the Infrastructure /
/// WebApi assemblies — keeping the Application layer free of any specific
/// implementation choice.
/// </para>
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        // Scan this assembly for IValidator<T> implementations.
        // typeof().Assembly because AddValidatorsFromAssemblyContaining<T>
        // rejects static class type arguments.
        services.AddValidatorsFromAssembly(
            typeof(DependencyInjection).Assembly,
            ServiceLifetime.Singleton);

        // Handlers are registered explicitly — keeps wire-up boring and grep-able.
        // Auth
        services.AddScoped<GetOrProvisionStaffHandler>();
        services.AddScoped<GetCurrentStaffHandler>();
        services.AddScoped<RefreshTokenHandler>();
        services.AddScoped<LogoutHandler>();
        // Cases
        services.AddScoped<PostCaseHandler>();
        services.AddScoped<GetPublicQueueHandler>();
        services.AddScoped<GetQueuedCasesHandler>();
        services.AddScoped<TakeCaseHandler>();
        services.AddScoped<TakeNextCaseHandler>();
        services.AddScoped<EscalateCaseHandler>();
        services.AddScoped<ResolveCaseHandler>();
        // Devices
        services.AddScoped<RecordHeartbeatHandler>();
        services.AddScoped<ChangeDeviceModeHandler>();
        services.AddScoped<GetDeviceStatusHandler>();
        services.AddScoped<ListDevicesHandler>();
        services.AddScoped<CheckPairingStatusHandler>();
        services.AddScoped<UpdateDeviceNameHandler>();
        services.AddScoped<UnpairDeviceHandler>();
        // Feedback
        services.AddScoped<SubmitFeedbackHandler>();
        services.AddScoped<SendFeedbackHandler>();
        services.AddScoped<OverrideFeedbackHandler>();
        // Pairing
        services.AddScoped<GenerateQrHandler>();
        services.AddScoped<CompletePairingHandler>();
        // SignalR webhooks
        services.AddScoped<MarkDeviceConnectedHandler>();
        services.AddScoped<MarkDeviceDisconnectedHandler>();
        // Reporting / Excel
        services.AddScoped<GetExportPreviewHandler>();
        services.AddScoped<ExportCasesAsJsonHandler>();
        services.AddScoped<ExportCasesAsExcelHandler>();

        return services;
    }
}
