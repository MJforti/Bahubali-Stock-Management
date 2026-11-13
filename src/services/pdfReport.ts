/**
 * Stock report as a PDF, made on the phone (works offline).
 * Follows the store picked at the top: one store, or all stores with a
 * column per store.
 */
import { MAIN_STORE_ID, Product, Store } from '../types/inventory';
import { ALL_STORES, StoreScope, stockIn, stockMap } from '../lib/stores';

const num = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
// The built-in PDF fonts have no rupee sign
const rs = (n: number) => `Rs ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export async function exportStockReportPdf(products: Product[], opts: { stores: Store[]; scope: StoreScope; by: string }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const active = opts.stores.filter((s) => s.is_active);
  const storeName = (id: string) => opts.stores.find((s) => s.id === id)?.name || (id === MAIN_STORE_ID ? 'Main Store' : 'Store');
  const all = opts.scope === ALL_STORES;
  const perStore = all && active.length > 1 ? active : [];
  const list = products
    .filter((p) => p.is_active !== false && (all || opts.scope in stockMap(p)))
    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));

  const qty = (p: Product) => stockIn(p, opts.scope);
  const status = (p: Product) => (qty(p) <= 0 ? 'Out' : qty(p) <= Number(p.minimum_stock) ? 'Low' : '');
  const units = list.reduce((a, p) => a + Math.max(0, qty(p)), 0);
  const value = list.reduce((a, p) => a + Math.max(0, qty(p)) * Number(p.purchase_price || 0), 0);
  const outCount = list.filter((p) => status(p) === 'Out').length;
  const lowCount = list.filter((p) => status(p) === 'Low').length;

  const doc = new jsPDF({ orientation: perStore.length > 1 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  const now = new Date();
  const when = now.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const where = all ? 'All stores' : storeName(opts.scope);

  // Header
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20);
  doc.text('Stock report', M, M + 6);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100);
  doc.text(`Bahubali Enterprises · ${where}`, M, M + 22);
  doc.text(`${when} · by ${opts.by}`, W - M, M + 22, { align: 'right' });

  // Summary
  const boxes: [string, string][] = [
    ['Products', num(list.length)],
    ['Units in stock', num(units)],
    ['Stock value (cost)', rs(value)],
    ['Low stock', num(lowCount)],
    ['Out of stock', num(outCount)]
  ];
  const bw = (W - M * 2) / boxes.length;
  boxes.forEach(([label, v], i) => {
    const x = M + i * bw;
    doc.setDrawColor(220).roundedRect(x + 2, M + 34, bw - 4, 40, 4, 4);
    doc.setFontSize(8).setTextColor(110).text(label, x + 10, M + 48);
    const warn = i >= 3 && v !== '0';
    doc.setFont('helvetica', 'bold').setFontSize(12);
    if (warn) doc.setTextColor(i === 4 ? 190 : 180, i === 4 ? 40 : 110, 0);
    else doc.setTextColor(20);
    doc.text(v, x + 10, M + 66);
    doc.setFont('helvetica', 'normal');
  });

  // Stock table
  const head = ['Product', 'SKU', 'Rack', ...perStore.map((s) => s.name), perStore.length ? 'Total' : 'Stock', 'Unit', 'Min', 'Cost', 'Value', 'Status'];
  const body = list.map((p) => [
    `${p.name}${p.brand ? `\n${p.brand}` : ''}`,
    p.sku || '',
    p.rack || '',
    ...perStore.map((s) => num(stockIn(p, s.id))),
    num(qty(p)),
    String(p.unit || ''),
    num(p.minimum_stock),
    rs(p.purchase_price),
    rs(Math.max(0, qty(p)) * Number(p.purchase_price || 0)),
    status(p)
  ]);
  autoTable(doc, {
    startY: M + 88,
    head: [head],
    body,
    margin: { left: M, right: M, bottom: 40 },
    styles: { fontSize: 8, cellPadding: 4, textColor: 30, lineColor: 230, lineWidth: 0.5 },
    headStyles: { fillColor: [38, 38, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    // Numbers right-aligned: store columns, stock, minimum, cost, value
    columnStyles: Object.fromEntries(
      head.map((h, i) => [i, i >= 3 && !['Unit', 'Status'].includes(h) ? { halign: 'right' as const } : {}])
    ),
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === head.length - 1) {
        if (d.cell.raw === 'Out') d.cell.styles.textColor = [190, 40, 40];
        if (d.cell.raw === 'Low') d.cell.styles.textColor = [180, 110, 0];
        d.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // What to restock, per store
  const restock: string[][] = [];
  for (const p of list) {
    const ids = all ? Object.keys(stockMap(p)) : [opts.scope];
    for (const id of ids) {
      const q = stockIn(p, id);
      if (q <= Number(p.minimum_stock)) restock.push([p.name, storeName(id), num(q), num(p.minimum_stock), num(Math.max(0, Number(p.minimum_stock) - q)), String(p.unit || '')]);
    }
  }
  if (restock.length) {
    const y = (doc as any).lastAutoTable.finalY + 24;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(20).text('To restock', M, y);
    autoTable(doc, {
      startY: y + 8,
      head: [['Product', 'Store', 'In stock', 'Minimum', 'Short by', 'Unit']],
      body: restock,
      margin: { left: M, right: M, bottom: 40 },
      styles: { fontSize: 8, cellPadding: 4, textColor: 30, lineColor: 230, lineWidth: 0.5 },
      headStyles: { fillColor: [38, 38, 40], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(140);
    doc.text(`Bahubali Enterprises · Stock report · ${where}`, M, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  const file = `Stock_report_${where.replace(/[^\w]+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
  const blob = doc.output('blob');
  const pdf = new File([blob], file, { type: 'application/pdf' });
  // Installed iPhone apps can't download files: use the share sheet there
  const iosApp = /iphone|ipad|ipod/i.test(navigator.userAgent) && ((navigator as any).standalone || matchMedia('(display-mode: standalone)').matches);
  if (iosApp && navigator.canShare?.({ files: [pdf] })) {
    try {
      await navigator.share({ files: [pdf], title: 'Stock report' });
      return { products: list.length, file };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { products: list.length, file };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { products: list.length, file };
}
