using Microsoft.Extensions.Options;
using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Auth.Commands;
using Tickets.Application.Auth.Handlers;
using Tickets.Application.Auth.Queries;
using Tickets.WebApi.Common;

namespace Tickets.WebApi.Endpoints;

public static class AuthEndpoints
{
    /// <summary>HttpOnly cookie carrying the refresh handle (mirrors the legacy <c>__Host-app_rf</c>).</summary>
    public const string RefreshCookieName = "__Host-app_rf";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/auth").WithTags("Auth");

        // /auth/me responds with { ok, user } to match the legacy contract
        // (frontend reads response.user.id etc.).
        group.MapGet("/me", async (
            GetCurrentStaffHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCurrentStaffQuery(), ct);
            if (!result.IsSuccess)
            {
                return result.ToHttpResult();
            }
            return Results.Json(new { ok = true, user = result.Value });
        }).RequireAuthorization();

        // POST /auth/refresh — reads the refresh handle from the HttpOnly
        // cookie, rotates it, and sets a new cookie. Body is empty.
        group.MapPost("/refresh", async (
            HttpContext httpContext,
            RefreshTokenHandler handler,
            IOptions<AppJwtOptions> options,
            CancellationToken ct) =>
        {
            httpContext.Request.Cookies.TryGetValue(RefreshCookieName, out var handle);
            var result = await handler.HandleAsync(
                new RefreshTokenCommand(handle ?? string.Empty), ct);

            if (!result.IsSuccess)
            {
                return result.ToHttpResult();
            }

            SetRefreshCookie(
                httpContext,
                result.Value!.RefreshHandle,
                result.Value.RefreshExpireAt,
                options.Value);

            return Results.Json(new
            {
                accessToken = result.Value.AccessToken,
                expireAt = result.Value.AccessTokenExpireAt,
            });
        }).AllowAnonymous();

        // POST /auth/logout — invalidates the refresh handle and clears the cookie.
        group.MapPost("/logout", async (
            HttpContext httpContext,
            LogoutHandler handler,
            CancellationToken ct) =>
        {
            httpContext.Request.Cookies.TryGetValue(RefreshCookieName, out var handle);
            var result = await handler.HandleAsync(
                new LogoutCommand(handle ?? string.Empty), ct);

            httpContext.Response.Cookies.Delete(RefreshCookieName);
            return result.ToHttpResult(StatusCodes.Status204NoContent);
        }).AllowAnonymous();

        return app;
    }

    private static void SetRefreshCookie(
        HttpContext httpContext,
        string handle,
        DateTimeOffset expireAt,
        AppJwtOptions _)
    {
        // __Host- prefix means: secure + path=/ + no Domain. SameSite=None is
        // required for cross-origin refresh from the frontend. Mirrors the
        // legacy backend cookie config.
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = expireAt,
            IsEssential = true,
        };
        httpContext.Response.Cookies.Append(RefreshCookieName, handle, cookieOptions);
    }
}
