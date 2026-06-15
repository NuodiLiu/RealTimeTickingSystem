using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Cases;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class CaseIdConverter()
    : ValueConverter<CaseId, Guid>(
        id => id.Value,
        value => new CaseId(value));
