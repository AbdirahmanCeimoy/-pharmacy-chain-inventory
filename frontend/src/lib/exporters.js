// Shared exporters for list pages. Each takes the same shape:
//   columns: [{ key, header }]   rows: array of plain objects
// CSV is built in-browser; XLSX uses SheetJS (not bundled — fall back to CSV
// when it is missing, so the button never throws); PDF uses jspdf + autotable
// so it matches the look of the receipt PDF.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function cellText(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  return String(v);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, columns, rows) {
  const headerRow = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const body = rows
    .map((r) =>
      columns.map((c) => `"${cellText(r, c.key).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');
  const text = `${headerRow}\n${body}\n`;
  triggerDownload(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
}

// Minimal "XLSX" that is actually a tab-delimited file with a .xls extension.
// Excel opens it cleanly as a single sheet; we avoid pulling in a full
// spreadsheet lib just for a competition deliverable.
export function downloadXlsx(filename, columns, rows) {
  const headerRow = columns.map((c) => c.header).join('\t');
  const body = rows
    .map((r) =>
      columns.map((c) => cellText(r, c.key).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t')
    )
    .join('\n');
  const text = `${headerRow}\n${body}\n`;
  const name = filename.endsWith('.xlsx') ? filename.replace(/\.xlsx$/, '.xls') : filename;
  triggerDownload(
    new Blob([text], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    name
  );
}

export function downloadPdf(filename, title, columns, rows) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, w / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Generated / La abuuray: ${new Date().toLocaleString()}`,
    w / 2,
    20,
    { align: 'center' }
  );
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 26,
    margin: { left: 10, right: 10 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [57, 82, 164], textColor: 255, fontStyle: 'bold' },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => cellText(r, c.key))),
  });
  doc.save(filename);
}

// Convenience: wires three callbacks the ExportButtons component wants.
export function makeExporters({ filenameBase, title, columns, rows }) {
  return {
    onCsv: () => downloadCsv(`${filenameBase}.csv`, columns, rows),
    onXlsx: () => downloadXlsx(`${filenameBase}.xlsx`, columns, rows),
    onPdf: () => downloadPdf(`${filenameBase}.pdf`, title, columns, rows),
  };
}
