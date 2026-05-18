using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class FeedbackRatingConverter()
    : ValueConverter<FeedbackRating, int>(
        r => r.Value,
        value => FeedbackRating.From(value));
