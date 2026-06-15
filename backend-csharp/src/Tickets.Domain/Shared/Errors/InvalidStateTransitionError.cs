namespace Tickets.Domain.Shared.Errors;

/// <summary>
/// Raised when a state machine method is invoked against an illegal source state.
/// <para>
/// Translated to HTTP 409 Conflict by the Application/WebApi layer.
/// AGENTS.md §4 — every aggregate method documents its allowed source states;
/// any other state landing here is a bug or a stale client.
/// </para>
/// </summary>
public sealed class InvalidStateTransitionError : DomainError
{
    public string AggregateName { get; }
    public string FromState { get; }
    public string Operation { get; }

    public InvalidStateTransitionError(string aggregateName, string fromState, string operation)
        : base("invalid_state_transition",
               $"Cannot perform '{operation}' on {aggregateName} while in state '{fromState}'.")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(aggregateName);
        ArgumentException.ThrowIfNullOrWhiteSpace(fromState);
        ArgumentException.ThrowIfNullOrWhiteSpace(operation);
        AggregateName = aggregateName;
        FromState = fromState;
        Operation = operation;
    }
}
