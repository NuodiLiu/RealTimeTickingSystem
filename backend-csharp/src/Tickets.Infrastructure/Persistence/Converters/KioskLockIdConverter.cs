using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class KioskLockIdConverter()
    : ValueConverter<KioskLockId, Guid>(
        id => id.Value,
        value => new KioskLockId(value));
