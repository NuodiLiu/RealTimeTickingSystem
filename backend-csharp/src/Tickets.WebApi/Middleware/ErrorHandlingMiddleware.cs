using System.Globalization;
using System.Text.Json;
using Tickets.Application.Common;
using Tickets.Domain.Shared.Errors;

namespace Tickets.WebApi.Middleware;

/// <summary>
/// Last-resort catch-all. Application handlers return <c>Result.Failure</c>
/// for expected business errors; this middleware only fires when something
/// genuinely unexpected escapes (DB outage, infrastructure crash) or when
/// a stray <see cref="DomainError"/> bypasses the handler boundary.
/// </summary>
public sealed class ErrorHandlingMiddleware(
    RequestDelegate next,
    ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        try
        {
            await next(context).ConfigureAwait(false);
        }
        catch (DomainError ex)
        {
            logger.LogWarning(ex,
                "DomainError escaped handler boundary: {Code}", ex.Code);
            await WriteAsync(context, DomainErrorMapper.ToAppError(ex)).ConfigureAwait(false);
        }
        catch (BadHttpRequestException ex)
        {
            // Body parsing / malformed-request failures from the framework.
            logger.LogWarning(ex, "Bad HTTP request");
            await WriteAsync(context, AppError.Validation(ex.Message)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            await WriteAsync(context, AppError.Internal("Internal server error.")).ConfigureAwait(false);
        }
    }

    private static async Task WriteAsync(HttpContext context, AppError error)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = error.HttpStatus;
        context.Response.ContentType = "application/json";

        var body = new Dictionary<string, string>
        {
            ["error"] = error.Code,
            ["error_description"] = error.Description,
        };
        var json = JsonSerializer.Serialize(body);
        await context.Response.WriteAsync(json, System.Text.Encoding.UTF8).ConfigureAwait(false);

        _ = CultureInfo.InvariantCulture; // suppress "unused" if analyzer adds it later
    }
}
