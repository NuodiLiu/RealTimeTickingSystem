using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class IdentityKeyConverter()
    : ValueConverter<IdentityKey, string>(
        key => key.Value,
        raw => IdentityKey.FromRaw(raw));
