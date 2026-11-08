// Bilingual sales receipt generator. Produces a tidy A5-sized PDF with English
// AND Somali labels on every row, so the output stays legible for either
// audience regardless of the current UI language. Called from ReceiptPage.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PAYMENT_LABEL = {
  CASH: 'Cash',
  EVC_PLUS: 'EVC Plus',
  ZAAD: 'Zaad',
  E_DAHAB: 'eDahab',
};

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

export function downloadReceiptPdf(sale, { copy = false } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sale.branchName, w / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (sale.branchAddress) {
    doc.text(sale.branchAddress, w / 2, y, { align: 'center' });
    y += 4;
  }
  if (sale.branchPhone) {
    doc.text(`Tel / Tel: ${sale.branchPhone}`, w / 2, y, { align: 'center' });
    y += 4;
  }

  doc.setDrawColor(180);
  doc.line(10, y + 1, w - 10, y + 1);
  y += 5;

  doc.setFontSize(9);
  doc.text(`Receipt / Rasiidh: ${sale.receiptNo}`, 10, y);
  doc.text(new Date(sale.createdAt).toLocaleString(), w - 10, y, { align: 'right' });
  y += 5;

  if (copy) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('COPY / NUSKHO', w / 2, y, { align: 'center' });
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }

  autoTable(doc, {
    startY: y + 2,
    margin: { left: 10, right: 10 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [57, 82, 164], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    head: [
      [
        'Item / Shay',
        'Qty / Tiro',
        'Price / Qiime',
        'Total / Wadarta',
      ],
    ],
    body: sale.items.map((item) => [
      `${item.medicine.genericName} ${item.medicine.strength}\n${item.medicine.brandName} · ${item.medicine.form}`,
      String(item.qty),
      money(item.unitPrice),
      money(item.lineTotal),
    ]),
  });

  y = doc.lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total / Wadarta', 10, y);
  doc.text(money(sale.total), w - 10, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Payment / Bixinta', 10, y);
  doc.text(PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod, w - 10, y, { align: 'right' });
  y += 5;

  doc.text('Cashier / Iibiyaha', 10, y);
  doc.text(sale.cashierName || '-', w - 10, y, { align: 'right' });
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Thank you for your purchase.', w / 2, y, { align: 'center' });
  y += 4;
  doc.text('Mahadsanid iibsashadaada.', w / 2, y, { align: 'center' });

  doc.save(`receipt-${sale.receiptNo}.pdf`);
}
