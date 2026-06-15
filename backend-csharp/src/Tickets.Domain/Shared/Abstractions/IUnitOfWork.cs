namespace Tickets.Domain.Shared.Abstractions;

/// <summary>
/// Atomically persist all pending repository changes. EF Core implementation
/// translates <see cref="Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException"/>
/// into a <see cref="Tickets.Domain.Shared.Errors.ConcurrencyError"/>.
/// </summary>
public interface IUnitOfWork
{
    Task CommitAsync(CancellationToken cancellationToken = default);
}
