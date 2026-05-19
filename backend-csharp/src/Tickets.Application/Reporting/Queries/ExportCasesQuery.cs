using Tickets.Domain.Cases;

namespace Tickets.Application.Reporting.Queries;

public sealed record ExportCasesQuery(CaseExportFilters Filters);
