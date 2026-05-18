namespace Tickets.Application.Common;

/// <summary>
/// Application-level error model. WebApi middleware translates these to HTTP
/// responses using the OAuth-2.0-style schema:
/// <code>{ "error": "&lt;Code&gt;", "error_description": "&lt;Description&gt;" }</code>
/// </summary>
public sealed record AppError(string Code, string Description, int HttpStatus)
{
    public static AppError Validation(string description) =>
        new("invalid_request", description, 400);

    public static AppError NotFound(string code, string description) =>
        new(code, description, 404);

    public static AppError Conflict(string code, string description) =>
        new(code, description, 409);

    public static AppError Forbidden(string code, string description) =>
        new(code, description, 403);

    public static AppError Unauthorized(string code, string description) =>
        new(code, description, 401);

    public static AppError Internal(string description) =>
        new("internal_error", description, 500);
}
