namespace Tickets.Domain.Shared.Errors;

/// <summary>
/// Base type for all domain rule violations. Domain methods throw a derived type
/// when an operation is not allowed by an invariant or by the state machine.
/// <para>
/// Application layer translates these into OAuth-2.0-style error responses
/// (see AGENTS.md §7 #12 and existing api-*.md "error code" tables).
/// </para>
/// </summary>
public abstract class DomainError : Exception
{
    /// <summary>Stable machine-readable code (snake_case), shared with frontend contracts.</summary>
    public string Code { get; }

    protected DomainError(string code, string message) : base(message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        Code = code;
    }
}
