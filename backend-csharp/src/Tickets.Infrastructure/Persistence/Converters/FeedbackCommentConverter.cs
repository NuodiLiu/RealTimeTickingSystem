using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class FeedbackCommentConverter()
    : ValueConverter<FeedbackComment, string>(
        c => c.Value,
        raw => FeedbackComment.Parse(raw));
