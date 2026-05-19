namespace Tickets.Application.Auth.Commands;

/// <summary>
/// Carries the opaque refresh handle from the caller (WebApi reads it from
/// the <c>__Host-app_rf</c> HttpOnly cookie and passes it down).
/// </summary>
public sealed record RefreshTokenCommand(string RefreshHandle);
