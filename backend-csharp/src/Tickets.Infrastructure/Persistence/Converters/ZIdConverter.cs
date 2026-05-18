using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Cases;

namespace Tickets.Infrastructure.Persistence.Converters;

/// <summary>
/// Non-nullable converter used on <see cref="ZId"/> columns. The
/// <c>Case.ZId</c> property is <c>ZId?</c>; EF Core lifts this converter
/// over <c>Nullable&lt;T&gt;</c> automatically so we only need the
/// value-to-value mapping here.
/// </summary>
internal sealed class ZIdConverter()
    : ValueConverter<ZId, string>(
        z => z.Value,
        raw => ZId.Parse(raw));
