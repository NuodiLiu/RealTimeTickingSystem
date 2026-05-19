namespace Tickets.Application.Auth.Commands;

/// <summary>
/// Logout invalidates the refresh handle so future <c>/auth/refresh</c> calls
/// fail. The short-lived App-JWT itself remains valid until its own
/// expiration (api-auth.md known pitfall #4 — see note in AGENTS.md).
/// </summary>
public sealed record LogoutCommand(string RefreshHandle);
