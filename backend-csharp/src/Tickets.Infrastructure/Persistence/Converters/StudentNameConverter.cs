using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Cases;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class StudentNameConverter()
    : ValueConverter<StudentName, string>(
        name => name.Value,
        raw => StudentName.Parse(raw));
