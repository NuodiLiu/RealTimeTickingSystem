using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class FeedbackSessionIdConverter()
    : ValueConverter<FeedbackSessionId, Guid>(
        id => id.Value,
        value => new FeedbackSessionId(value));
