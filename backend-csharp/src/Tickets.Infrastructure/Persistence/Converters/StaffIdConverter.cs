using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Persistence.Converters;

/// <summary>
/// Maps the strongly-typed <see cref="StaffId"/> (a <c>record struct</c>) to
/// Postgres <c>uuid</c>. AGENTS.md §9.1 forbids raw <c>Guid</c> in method
/// signatures; this converter is what makes that practical at the EF level.
/// </summary>
internal sealed class StaffIdConverter()
    : ValueConverter<StaffId, Guid>(
        id => id.Value,
        value => new StaffId(value));
