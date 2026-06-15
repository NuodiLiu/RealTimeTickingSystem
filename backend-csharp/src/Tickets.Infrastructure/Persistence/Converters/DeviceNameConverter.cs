using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Devices;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class DeviceNameConverter()
    : ValueConverter<DeviceName, string>(
        n => n.Value,
        raw => DeviceName.Parse(raw));
