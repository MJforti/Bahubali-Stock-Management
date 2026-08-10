import * as XLSX from 'xlsx';
import { Product, ExcelColumnMapping } from '../types/inventory';

export function exportInventoryToExcel(products: Product[], filename = 'Bahubali_Enterprises_Inventory') {
  const exportData = products.map((p) => ({
    'Product Name': p.name,
    'Brand': p.brand,
    'Category': p.category,
    'Sub-category': p.sub_category || '',
    'SKU': p.sku,
    'Current Stock': p.current_stock,
    'Unit': p.unit,
    'Min Stock': p.minimum_stock,
    'Reorder Level': p.reorder_level,
    'Purchase Price (₹)': p.purchase_price,
    'Selling Price (₹)': p.selling_price,
    'Supplier': p.supplier || '',
    'Rack / Location': p.rack || '',
    'Status': p.is_active ? 'Active' : 'Inactive',
    'Description': p.description || '',
    'Image URL': p.image_url || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Inventory');

  // Auto-fit columns
  const colWidths = [
    { wch: 30 }, // Name
    { wch: 15 }, // Brand
    { wch: 20 }, // Category
    { wch: 15 }, // Sub
    { wch: 16 }, // SKU
    { wch: 12 }, // Stock
    { wch: 10 }, // Unit
    { wch: 10 }, // Min
    { wch: 12 }, // Reorder
    { wch: 16 }, // Purchase
    { wch: 16 }, // Selling
    { wch: 20 }, // Supplier
    { wch: 15 }, // Rack
    { wch: 10 }, // Status
    { wch: 30 }, // Description
    { wch: 40 }  // Image URL
  ];
  worksheet['!cols'] = colWidths;

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
}

export function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
        
        if (jsonRows.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        const headers = Object.keys(jsonRows[0]);
        resolve({ headers, rows: jsonRows });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function autoMapColumns(headers: string[]): ExcelColumnMapping {
  const mapping: ExcelColumnMapping = {
    name: '',
    brand: '',
    category: '',
    sku: '',
    stock: '',
    unit: '',
    min_stock: '',
    purchase_price: '',
    selling_price: '',
    supplier: '',
    rack: ''
  };

  const findMatch = (candidates: string[]) => {
    return headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))) || '';
  };

  mapping.name = findMatch(['product name', 'name', 'item name', 'item', 'title']);
  mapping.brand = findMatch(['brand', 'company', 'make']);
  mapping.category = findMatch(['category', 'group', 'type']);
  mapping.sku = findMatch(['sku', 'product code', 'code', 'item code', 'part number']);
  mapping.stock = findMatch(['current stock', 'stock', 'qty', 'quantity', 'balance']);
  mapping.unit = findMatch(['unit', 'uom', 'measure']);
  mapping.min_stock = findMatch(['min stock', 'minimum stock', 'min qty', 'reorder level']);
  mapping.purchase_price = findMatch(['purchase price', 'buy price', 'cost', 'cost price']);
  mapping.selling_price = findMatch(['selling price', 'sale price', 'mrps', 'price', 'rate']);
  mapping.supplier = findMatch(['supplier', 'vendor', 'distributor']);
  mapping.rack = findMatch(['rack', 'location', 'shelf', 'section']);

  return mapping;
}

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export function validateImportRows(
  rows: Record<string, any>[],
  mapping: ExcelColumnMapping,
  existingSkus: Set<string>
): { validProducts: Partial<Product>[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const validProducts: Partial<Product>[] = [];
  const seenSkus = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // 1-indexed header + 1
    const name = String(row[mapping.name] || '').trim();
    const brand = String(row[mapping.brand] || 'Generic').trim();
    const category = String(row[mapping.category] || 'General Hardware').trim();
    let sku = String(row[mapping.sku] || '').trim();
    const stockStr = row[mapping.stock];
    const unit = String(row[mapping.unit] || 'Piece').trim();
    const minStockStr = row[mapping.min_stock];
    const purchasePriceStr = row[mapping.purchase_price];
    const sellingPriceStr = row[mapping.selling_price];
    const supplier = String(row[mapping.supplier] || '').trim();
    const rack = String(row[mapping.rack] || '').trim();

    if (!name) {
      errors.push({ rowIndex: rowNum, field: 'name', message: 'Product Name is missing' });
      return;
    }

    if (!sku) {
      // Auto generate SKU if missing
      sku = `SKU-${name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (seenSkus.has(sku) || existingSkus.has(sku)) {
      errors.push({ rowIndex: rowNum, field: 'sku', message: `Duplicate SKU "${sku}"` });
      return;
    }

    const current_stock = Number(stockStr) || 0;
    if (isNaN(current_stock) || current_stock < 0) {
      errors.push({ rowIndex: rowNum, field: 'stock', message: 'Stock must be a non-negative number' });
      return;
    }

    seenSkus.add(sku);

    validProducts.push({
      name,
      brand,
      category,
      sku,
      current_stock,
      unit,
      minimum_stock: Number(minStockStr) || 5,
      reorder_level: Number(minStockStr) ? Number(minStockStr) * 2 : 10,
      purchase_price: Number(purchasePriceStr) || 0,
      selling_price: Number(sellingPriceStr) || 0,
      supplier,
      rack,
      is_active: true
    });
  });

  return { validProducts, errors };
}
