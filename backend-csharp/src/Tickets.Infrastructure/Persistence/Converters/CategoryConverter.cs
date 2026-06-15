using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Cases;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class CategoryConverter()
    : ValueConverter<Category, string>(
        c => c.Value,
        raw => Category.Parse(raw));
