/**
 * Build and download an .xlsx workbook using ExcelJS (replaces vulnerable sheetjs/xlsx).
 * ExcelJS is loaded on demand to keep the main bundle smaller.
 */
export async function downloadWorkbook({
  sheetName,
  fileName,
  columns,
  rows,
}) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vestel MES';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns;
  worksheet.addRows(rows);
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
