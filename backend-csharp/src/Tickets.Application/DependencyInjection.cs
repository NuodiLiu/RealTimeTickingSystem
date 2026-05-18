using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Tickets.Application.Cases.Handlers;

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
        services.AddScoped<PostCaseHandler>();
        services.AddScoped<GetPublicQueueHandler>();
        services.AddScoped<GetQueuedCasesHandler>();
        services.AddScoped<TakeCaseHandler>();
        services.AddScoped<TakeNextCaseHandler>();
        services.AddScoped<EscalateCaseHandler>();
        services.AddScoped<ResolveCaseHandler>();

        return services;
    }
}
