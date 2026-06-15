using Tickets.Domain.Cases;

namespace Tickets.Application.Reporting.Queries;

public sealed record GetExportPreviewQuery(CaseExportFilters Filters);
