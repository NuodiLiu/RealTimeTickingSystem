using ClosedXML.Excel;
using Tickets.Application.Reporting.Abstractions;
using Tickets.Application.Reporting.Dtos;

namespace Tickets.Infrastructure.Reporting;

internal sealed class ClosedXmlWorkbookGenerator : IExcelWorkbookGenerator
{
    public byte[] BuildCasesWorkbook(IReadOnlyList<CaseExportRow> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Cases");

        string[] headers =
        [
            "Id", "ZId", "StudentName", "Category", "Status", "AssignedStaffId",
            "CreatedAt", "StartedAt", "ResolvedAt",
            "EscalatedTo", "ResolvedOnSite",
            "WaitingSeconds", "ProcessingSeconds",
        ];
        for (var i = 0; i < headers.Length; i++)
        {
            sheet.Cell(1, i + 1).Value = headers[i];
            sheet.Cell(1, i + 1).Style.Font.Bold = true;
        }

        for (var r = 0; r < rows.Count; r++)
        {
            var row = rows[r];
            var line = r + 2;
            sheet.Cell(line, 1).Value = row.Id.ToString();
            sheet.Cell(line, 2).Value = row.ZId;
            sheet.Cell(line, 3).Value = row.StudentName;
            sheet.Cell(line, 4).Value = row.Category;
            sheet.Cell(line, 5).Value = row.Status;
            sheet.Cell(line, 6).Value = row.AssignedStaffId?.ToString();
            sheet.Cell(line, 7).Value = row.CreatedAt.UtcDateTime;
            sheet.Cell(line, 8).Value = row.StartedAt?.UtcDateTime;
            sheet.Cell(line, 9).Value = row.ResolvedAt?.UtcDateTime;
            sheet.Cell(line, 10).Value = row.EscalatedTo;
            // bool? -> string for portability (Excel cell value doesn't take bool? directly).
            sheet.Cell(line, 11).Value = row.ResolvedOnSite?.ToString();
            sheet.Cell(line, 12).Value = row.WaitingSeconds;
            sheet.Cell(line, 13).Value = row.ProcessingSeconds;
        }

        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
