using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class DeviceIdConverter()
    : ValueConverter<DeviceId, Guid>(
        id => id.Value,
        value => new DeviceId(value));
