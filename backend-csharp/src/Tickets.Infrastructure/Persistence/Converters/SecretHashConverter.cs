using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class SecretHashConverter()
    : ValueConverter<SecretHash, string>(
        h => h.Value,
        raw => SecretHash.FromRaw(raw));
