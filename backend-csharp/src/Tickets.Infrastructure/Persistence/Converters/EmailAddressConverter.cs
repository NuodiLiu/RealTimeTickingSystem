using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Tickets.Domain.Shared.ValueObjects;

namespace Tickets.Infrastructure.Persistence.Converters;

internal sealed class EmailAddressConverter()
    : ValueConverter<EmailAddress, string>(
        email => email.Value,
        raw => EmailAddress.Parse(raw));
