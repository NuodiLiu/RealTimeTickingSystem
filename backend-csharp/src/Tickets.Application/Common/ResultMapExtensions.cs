namespace Tickets.Application.Common;

/// <summary>
/// Functional helpers over <see cref="Result{T}"/>. Lets endpoints reshape a
/// handler's success value (e.g. wrap a <c>CaseDto</c> in a <c>{ case }</c>
/// envelope) while propagating the failure path untouched.
/// </summary>
public static class ResultMapExtensions
{
    public static Result<TOut> Map<TIn, TOut>(this Result<TIn> result, Func<TIn?, TOut> map)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(map);
        return result.IsSuccess
            ? Result<TOut>.Success(map(result.Value))
            : Result<TOut>.Failure(result.Error!);
    }
}
