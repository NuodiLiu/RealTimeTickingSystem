using Tickets.Application.Reporting.Dtos;

namespace Tickets.Application.Reporting.Abstractions;

/// <summary>
/// Produces the binary xlsx for the export endpoint. Infrastructure uses
/// ClosedXML; the interface stays here so handlers can be tested with a
/// substitute and Domain stays untouched.
/// </summary>
public interface IExcelWorkbookGenerator
{
    byte[] BuildCasesWorkbook(IReadOnlyList<CaseExportRow> rows);
}
