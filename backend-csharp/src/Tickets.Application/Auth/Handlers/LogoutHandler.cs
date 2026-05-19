using Tickets.Application.Auth.Abstractions;
using Tickets.Application.Auth.Commands;
using Tickets.Application.Common;

namespace Tickets.Application.Auth.Handlers;

/// <summary>
/// Best-effort handle invalidation. A missing or already-deleted handle is
/// treated as success (idempotent) so the client always gets a clean 200.
/// </summary>
public sealed class LogoutHandler(IRefreshHandleStore handleStore)
{
    public async Task<Result> HandleAsync(
        LogoutCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (!string.IsNullOrWhiteSpace(command.RefreshHandle))
        {
            await handleStore.DeleteAsync(command.RefreshHandle, cancellationToken).ConfigureAwait(false);
        }
        return Result.Success();
    }
}
