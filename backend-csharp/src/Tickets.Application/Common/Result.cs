namespace Tickets.Application.Common;

/// <summary>
/// Handler return type. Carries either a value or an <see cref="AppError"/> —
/// never both. Application code is expected to return failures via
/// <see cref="Failure(AppError)"/> rather than throwing.
/// <para>
/// AGENTS.md §7 Non-negotiable #5: business-flow errors use Result/AppError;
/// only true infrastructure exceptions throw.
/// </para>
/// </summary>
public sealed class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public AppError? Error { get; }

    private Result(bool ok, T? value, AppError? error)
    {
        IsSuccess = ok;
        Value = value;
        Error = error;
    }

    public static Result<T> Success(T value) => new(ok: true, value, error: null);

    public static Result<T> Failure(AppError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new(ok: false, value: default, error);
    }
}

/// <summary>Non-generic flavour for commands that return no value.</summary>
public sealed class Result
{
    public bool IsSuccess { get; }
    public AppError? Error { get; }

    private Result(bool ok, AppError? error)
    {
        IsSuccess = ok;
        Error = error;
    }

    public static Result Success() => new(ok: true, error: null);

    public static Result Failure(AppError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new(ok: false, error);
    }
}
