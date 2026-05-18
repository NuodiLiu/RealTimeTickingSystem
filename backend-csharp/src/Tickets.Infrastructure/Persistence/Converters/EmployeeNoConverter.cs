using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Staff;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class EmployeeNoConverter()
    : ValueConverter<EmployeeNo, string>(
        no => no.Value,
        raw => EmployeeNo.FromRaw(raw));
