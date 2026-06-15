using Tickets.Domain.Devices.Errors;
using Tickets.Domain.FeedbackSessions.Errors;
using Tickets.Domain.Shared.Errors;

namespace Tickets.Application.Common;

/// <summary>
/// Maps thrown <see cref="DomainError"/> instances to <see cref="AppError"/>
/// with appropriate HTTP semantics. Handlers catch DomainError and route through
/// here rather than letting it bubble — keeps the WebApi error contract uniform.
/// </summary>
public static class DomainErrorMapper
{
    public static AppError ToAppError(DomainError error)
    {
        ArgumentNullException.ThrowIfNull(error);

        var status = error switch
        {
            InvalidStateTransitionError => 409,
            ConcurrencyError => 409,
            DeviceBusyError => 409,
            DeviceNotPairedError => 409,
            DeviceAlreadyPairedError => 409,
            LockNotActiveError => 409,
            LockPreconditionFailedError => 409,
            LockLeaseNotExpiredError => 409,
            InvalidDeviceModeError => 403,
            FeedbackExpireNotDueError => 409,
            _ => 400,
        };

        return new AppError(error.Code, error.Message, status);
    }
}
