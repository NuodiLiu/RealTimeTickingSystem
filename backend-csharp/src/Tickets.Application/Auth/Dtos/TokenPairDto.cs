namespace Tickets.Application.Auth.Dtos;

/// <summary>
/// Payload returned by <c>/auth/refresh</c>. The WebApi endpoint sets
/// <see cref="RefreshHandle"/> as an HttpOnly cookie (not body) when actually
/// responding, but it travels here so the handler can stay framework-free.
/// </summary>
public sealed record TokenPairDto(
    string AccessToken,
    DateTimeOffset AccessTokenExpireAt,
    string RefreshHandle,
    DateTimeOffset RefreshExpireAt);
