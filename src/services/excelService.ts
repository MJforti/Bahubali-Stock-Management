import { ExcelColumnMapping, MAIN_STORE_ID, Product, Store } from '../types/inventory';
import { ALL_STORES, StoreScope, stockIn, stockMap } from '../lib/stores';
import { INITIAL_CATEGORIES } from '../data/seedData';

/**
 * One list of columns, used by the export, the sample sheet and the import,
 * so a filled-in sample (or an export) imports without remapping.
 * One row per product per store: a product kept in two stores has two rows
 * with the same SKU.
 */
export const SHEET_COLUMNS: { key: keyof ExcelColumnMapping; header: string; width: number; help: string }[] = [
  { key: 'name', header: 'Product Name', width: 34, help: 'Required. What staff search for, e.g. Bosch 8mm Drill Bit for Concrete' },
  { key: 'brand', header: 'Brand', width: 16, help: 'e.g. Bosch, Asian Paints' },
  { key: 'category', header: 'Category', width: 22, help: 'One of the categories on this sheet, or a new one' },
  { key: 'sub_category', header: 'Sub-category', width: 16, help: 'Optional, e.g. Drill Bits' },
  { key: 'sku', header: 'SKU', width: 18, help: 'Product code. Same SKU on several rows = same product in several stores. Leave blank to make one' },
  { key: 'unit', header: 'Unit', width: 10, help: 'One of the units on this sheet' },
  { key: 'store', header: 'Store', width: 20, help: 'Store or godown name. Blank = the store selected in the app. New names become new stores' },
  { key: 'stock', header: 'Stock', width: 10, help: 'Quantity in that store now (opening stock). Whole or decimal number, 0 or more' },
  { key: 'min_stock', header: 'Minimum Stock', width: 14, help: 'Below this the product shows as low stock' },
  { key: 'reorder_level', header: 'Reorder Level', width: 13, help: 'Optional' },
  { key: 'purchase_price', header: 'Cost Price', width: 11, help: 'Buying price in ₹, numbers only' },
  { key: 'selling_price', header: 'Selling Price', width: 12, help: 'Selling price in ₹, numbers only' },
  { key: 'supplier', header: 'Supplier', width: 20, help: 'Optional' },
  { key: 'rack', header: 'Rack', width: 9, help: 'Rack or shelf code, e.g. B-12' },
  { key: 'description', header: 'Description', width: 36, help: 'Optional' }
];

export const UNITS = ['Piece', 'Box', 'Packet', 'Kg', 'Liter', 'Meter', 'Coil', 'Set', 'Pair', 'Bucket', 'Roll', 'Feet', 'Bag', 'Can'];

const rowFor = (p: Product, storeName: string, stock: number) => ({
  'Product Name': p.name,
  Brand: p.brand,
  Category: p.category,
  'Sub-category': p.sub_category || '',
  SKU: p.sku,
  Unit: p.unit,
  Store: storeName,
  Stock: stock,
  'Minimum Stock': p.minimum_stock,
  'Reorder Level': p.reorder_level,
  'Cost Price': p.purchase_price,
  'Selling Price': p.selling_price,
  Supplier: p.supplier || '',
  Rack: p.rack || '',
  Description: p.description || ''
});

function widths() {
  return SHEET_COLUMNS.map((c) => ({ wch: c.width }));
}

/** Export the products being viewed: one row per product per store. */
export async function exportInventoryToExcel(
  products: Product[],
  opts: { stores: Store[]; scope: StoreScope },
  filename = 'Bahubali_Enterprises_Inventory'
) {
  const XLSX = await import('xlsx');
  const name = (id: string) => opts.stores.find((s) => s.id === id)?.name || (id === MAIN_STORE_ID ? 'Main Store' : 'Store');
  const rows: ReturnType<typeof rowFor>[] = [];
  for (const p of products.filter((x) => x.is_active !== false)) {
    if (opts.scope === ALL_STORES) {
      for (const [storeId, qty] of Object.entries(stockMap(p))) rows.push(rowFor(p, name(storeId), qty));
    } else if (opts.scope in stockMap(p)) {
      rows.push(rowFor(p, name(opts.scope), stockIn(p, opts.scope)));
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows, { header: SHEET_COLUMNS.map((c) => c.header) });
  ws['!cols'] = widths();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock');
  const where = opts.scope === ALL_STORES ? 'All_Stores' : name(opts.scope).replace(/[^\w]+/g, '_');
  XLSX.writeFile(wb, `${filename}_${where}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** A ready-to-fill sheet with the app's columns, examples, and the valid choices. */
export async function downloadSampleSheet(stores: Store[]) {
  const XLSX = await import('xlsx');
  const active = stores.filter((s) => s.is_active);
  const main = active[0]?.name || 'Main Store';
  const other = active[1]?.name || 'Godown';
  const examples = [
    ['Bosch 8mm Drill Bit for Concrete', 'Bosch', 'Tools & Accessories', 'Drill Bits', 'DRL-BOS-8MM', 'Piece', main, 14, 5, 10, 120, 180, 'Bosch India Ltd', 'B-12', 'Carbide tip masonry bit'],
    ['Bosch 8mm Drill Bit for Concrete', 'Bosch', 'Tools & Accessories', 'Drill Bits', 'DRL-BOS-8MM', 'Piece', other, 40, 5, 10, 120, 180, 'Bosch India Ltd', 'B-12', ''],
    ['Asian Paints Primer White 4L', 'Asian Paints', 'Paint & Coatings', 'Primers', 'PNT-AP-PRIM-4L', 'Bucket', main, 12, 4, 8, 450, 620, 'Asian Paints Depot', 'P-04', '']
  ];
  const sheet = XLSX.utils.aoa_to_sheet([SHEET_COLUMNS.map((c) => c.header), ...examples]);
  sheet['!cols'] = widths();
  sheet['!freeze'] = { xSplit: 1, ySplit: 1 };

  const longest = Math.max(UNITS.length, INITIAL_CATEGORIES.length, active.length);
  const guide = [
    ['How to fill the Products sheet'],
    ['Replace the example rows with your products. Keep the first row (the column names) as it is.'],
    ['One row per product per store. To put the same product in two stores, repeat it with the same SKU and a different Store and Stock (see the Bosch example).'],
    ['Then in the app: Data sheet → Import from Excel → choose this file → Check and preview → Import.'],
    [],
    ['Column', 'What to put in it'],
    ...SHEET_COLUMNS.map((c) => [c.header, c.help]),
    [],
    ['Units', 'Categories', 'Stores in the app now'],
    ...Array.from({ length: longest }, (_, i) => [UNITS[i] || '', INITIAL_CATEGORIES[i]?.name || '', active[i]?.name || ''])
  ];
  const help = XLSX.utils.aoa_to_sheet(guide);
  help['!cols'] = [{ wch: 18 }, { wch: 90 }, { wch: 24 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Products');
  XLSX.utils.book_append_sheet(wb, help, 'How to fill');
  XLSX.writeFile(wb, 'Bahubali_Stock_Import_Sample.xlsx');
}

export function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        // Prefer a sheet called "Products" (the sample), else the first one
        const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'products') || workbook.SheetNames[0];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName], { defval: '' });
        if (jsonRows.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }
        resolve({ headers: Object.keys(jsonRows[0]), rows: jsonRows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export const emptyMapping = (): ExcelColumnMapping =>
  Object.fromEntries(SHEET_COLUMNS.map((c) => [c.key, ''])) as unknown as ExcelColumnMapping;

export function autoMapColumns(headers: string[]): ExcelColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const used = new Set<string>();
  const find = (candidates: string[]) => {
    // exact header first (the sample's own names), then "contains"
    const exact = headers.find((h) => !used.has(h) && candidates.some((c) => norm(h) === norm(c)));
    const loose = exact || headers.find((h) => !used.has(h) && candidates.some((c) => norm(h).includes(norm(c))));
    if (loose) used.add(loose);
    return loose || '';
  };
  const m = emptyMapping();
  // Order matters: specific names before generic ones like "name" or "price"
  m.sub_category = find(['sub-category', 'sub category', 'subcategory']);
  m.min_stock = find(['minimum stock', 'min stock', 'min qty', 'minimum']);
  m.reorder_level = find(['reorder level', 'reorder']);
  m.purchase_price = find(['cost price', 'purchase price', 'buy price', 'cost']);
  m.selling_price = find(['selling price', 'sale price', 'mrp', 'price', 'rate']);
  m.name = find(['product name', 'item name', 'name', 'item', 'product']);
  m.brand = find(['brand', 'company', 'make']);
  m.category = find(['category', 'group']);
  m.sku = find(['sku', 'product code', 'item code', 'code', 'part number']);
  m.unit = find(['unit', 'uom']);
  m.store = find(['store', 'godown', 'godawan', 'warehouse', 'shop', 'branch', 'location']);
  m.stock = find(['stock', 'current stock', 'opening stock', 'qty', 'quantity', 'balance']);
  m.supplier = find(['supplier', 'vendor', 'distributor']);
  m.rack = find(['rack', 'shelf', 'bin']);
  m.description = find(['description', 'details', 'notes']);
  return m;
}

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

/** Product to import; opening stock per store (keys are store ids, or "new:<name>" for stores to create). */
export type ImportProduct = Partial<Product> & { opening_by_store: Record<string, number> };

const num = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return NaN;
  return Number(String(v).replace(/[₹,\s]/g, ''));
};

export function validateImportRows(
  rows: Record<string, any>[],
  mapping: ExcelColumnMapping,
  existingSkus: Set<string>,
  stores: Store[],
  defaultStoreId: string
): { validProducts: ImportProduct[]; errors: ValidationError[]; newStoreNames: string[]; rowCount: number } {
  const errors: ValidationError[] = [];
  const bySku = new Map<string, ImportProduct>();
  const order: string[] = [];
  const newStoreNames = new Map<string, string>(); // lower -> as typed
  const existingLower = new Set([...existingSkus].map((s) => s.toLowerCase()));
  const activeStores = stores.filter((s) => s.is_active);
  const cell = (row: Record<string, any>, key: keyof ExcelColumnMapping) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '');
  let rowCount = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const name = cell(row, 'name');
    if (!name && Object.values(row).every((v) => String(v).trim() === '')) return; // blank line
    rowCount++;
    if (!name) {
      errors.push({ rowIndex: rowNum, field: 'name', message: 'Product name is missing' });
      return;
    }

    let sku = cell(row, 'sku');
    const brand = cell(row, 'brand') || 'Generic';
    if (!sku) {
      // Same name and brand on several rows without a SKU = same product
      const key = `${name}|${brand}`.toLowerCase();
      const earlier = [...bySku.values()].find((p) => `${p.name}|${p.brand}`.toLowerCase() === key);
      sku = earlier?.sku || `${brand.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'GEN'}-${name.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    }
    if (existingLower.has(sku.toLowerCase())) {
      errors.push({ rowIndex: rowNum, field: 'sku', message: `"${name}" (${sku}) is already in the app. Use Stock in to add to it` });
      return;
    }

    const stockRaw = cell(row, 'stock');
    const stock = stockRaw === '' ? 0 : num(stockRaw);
    if (!Number.isFinite(stock) || stock < 0) {
      errors.push({ rowIndex: rowNum, field: 'stock', message: `Stock "${stockRaw}" is not a number of 0 or more` });
      return;
    }

    // Which store this row's stock goes to
    const storeName = cell(row, 'store');
    let storeKey = defaultStoreId;
    if (storeName) {
      const match = activeStores.find((s) => s.name.toLowerCase() === storeName.toLowerCase());
      if (match) storeKey = match.id;
      else {
        newStoreNames.set(storeName.toLowerCase(), newStoreNames.get(storeName.toLowerCase()) || storeName);
        storeKey = `new:${storeName.toLowerCase()}`;
      }
    }

    const skuKey = sku.toLowerCase();
    const existing = bySku.get(skuKey);
    if (existing) {
      if (existing.name!.toLowerCase() !== name.toLowerCase()) {
        errors.push({ rowIndex: rowNum, field: 'sku', message: `SKU ${sku} is used for both "${existing.name}" and "${name}"` });
        return;
      }
      if (storeKey in existing.opening_by_store) {
        errors.push({ rowIndex: rowNum, field: 'store', message: `"${name}" appears twice for the same store` });
        return;
      }
      existing.opening_by_store[storeKey] = stock;
      existing.current_stock = (existing.current_stock || 0) + stock;
      return;
    }

    const minStock = num(cell(row, 'min_stock'));
    const reorder = num(cell(row, 'reorder_level'));
    const cost = num(cell(row, 'purchase_price'));
    const price = num(cell(row, 'selling_price'));
    const unitIn = cell(row, 'unit');
    const unit = UNITS.find((u) => u.toLowerCase() === unitIn.toLowerCase()) || unitIn || 'Piece';

    bySku.set(skuKey, {
      name,
      brand,
      category: cell(row, 'category') || 'Other',
      sub_category: cell(row, 'sub_category'),
      sku,
      unit,
      current_stock: stock,
      opening_by_store: { [storeKey]: stock },
      minimum_stock: Number.isFinite(minStock) ? minStock : 5,
      reorder_level: Number.isFinite(reorder) ? reorder : Number.isFinite(minStock) ? minStock * 2 : 10,
      purchase_price: Number.isFinite(cost) ? cost : 0,
      selling_price: Number.isFinite(price) ? price : 0,
      supplier: cell(row, 'supplier'),
      rack: cell(row, 'rack').toUpperCase(),
      description: cell(row, 'description'),
      is_active: true
    });
    order.push(skuKey);
  });

  return { validProducts: order.map((k) => bySku.get(k)!), errors, newStoreNames: [...newStoreNames.values()], rowCount };
}
