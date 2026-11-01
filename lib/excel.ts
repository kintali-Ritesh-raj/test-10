import {
  exportSheets,
  monthKeyToDisplay,
  type AttendanceRecord,
} from "./attendance";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Builds the month's Excel workbook in the browser and downloads it.
 * exceljs is loaded on demand so it is not part of the first page load.
 */
export async function downloadMonthExcel(
  records: AttendanceRecord[],
  monthKey: string
): Promise<void> {
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();

  for (const sheet of exportSheets(records, monthKey)) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRows(sheet.rows);
    sheet.widths.forEach((width, i) => {
      ws.getColumn(i + 1).width = width;
    });

    const header = ws.getRow(sheet.headerRow);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2A44" },
      };
    });

    if (sheet.totalRow) {
      const total = ws.getRow(sheet.totalRow);
      total.font = { bold: true };
      total.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFED7AA" },
        };
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${monthKeyToDisplay(monthKey).replace("/", "-")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
