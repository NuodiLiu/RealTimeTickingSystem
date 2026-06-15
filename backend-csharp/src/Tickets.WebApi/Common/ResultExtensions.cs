using Tickets.Application.Common;

namespace Tickets.WebApi.Common;

/// <summary>
/// Bridges <see cref="Result{T}"/> from handlers to Minimal API
/// <see cref="IResult"/> responses. Error responses follow the legacy Node
/// OAuth-2.0-style shape <c>{ error, error_description }</c> so frontend /
/// iPad clients don't have to change (AGENTS.md §8).
/// </summary>
public static class ResultExtensions
{
    public static IResult ToHttpResult<T>(this Result<T> result, int successStatus = StatusCodes.Status200OK)
    {
        ArgumentNullException.ThrowIfNull(result);
        return result.IsSuccess
            ? Results.Json(result.Value, statusCode: successStatus)
            : Failure(result.Error!);
    }

    public static IResult ToHttpResult(this Result result, int successStatus = StatusCodes.Status200OK)
    {
        ArgumentNullException.ThrowIfNull(result);
        return result.IsSuccess
            ? Results.StatusCode(successStatus)
            : Failure(result.Error!);
    }

    private static IResult Failure(AppError error)
    {
        // Anonymous type so the JSON keys land exactly as legacy clients expect
        // (snake_case "error_description"), regardless of any global naming
        // policy added later.
        var body = new Dictionary<string, string>
        {
            ["error"] = error.Code,
            ["error_description"] = error.Description,
        };
        return Results.Json(body, statusCode: error.HttpStatus);
    }
}
