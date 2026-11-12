import { Product, RealtimeStatus } from '../types/inventory';
import { diffProduct, logActivity } from '../lib/activity';
import { queueInTx, OUTBOX, PRODUCTS, getAll, withTransaction, assertSkuFree, newId, notifyOtherTabs } from '../lib/localDb';

export function normalizeProduct(p: any): Product {
  return {
    ...p,
    current_stock: Number(p.current_stock) || 0,
    minimum_stock: Number(p.minimum_stock) || 0,
    reorder_level: Number(p.reorder_level) || 0,
    maximum_stock: p.maximum_stock == null ? undefined : Number(p.maximum_stock),
    purchase_price: Number(p.purchase_price) || 0,
    selling_price: Number(p.selling_price) || 0,
    is_active: p.is_active !== false
  } as Product;
}

export async function fetchProducts(): Promise<{ products: Product[]; realtimeStatus: RealtimeStatus }> {
  const rows = await getAll<Product>(PRODUCTS);
  const products = rows.map(normalizeProduct).sort((a, b) => a.name.localeCompare(b.name));
  return { products, realtimeStatus: 'local_demo' };
}

export async function createProduct(
  productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
  opts: { silent?: boolean } = {}
): Promise<Product> {
  const now = new Date().toISOString();
  const product = normalizeProduct({
    ...productData,
    id: newId(),
    created_at: now,
    updated_at: now,
    details_updated_at: now,
    opening_stock: Number(productData.current_stock) || 0
  });
  if (!product.name?.trim()) throw new Error('Product name is required.');
  if (!product.sku?.trim()) throw new Error('SKU is required.');

  await withTransaction([PRODUCTS, OUTBOX], async (tx) => {
    await assertSkuFree(tx, product.sku);
    tx.objectStore(PRODUCTS).put(product);
    queueInTx(tx, { kind: 'product', id: product.id });
  });

  notifyOtherTabs({ kind: 'product', product });
  if (!opts.silent) {
    await logActivity('product.created', `Added ${product.name}`, {
      product_id: product.id,
      product_name: product.name,
      details: [`Opening stock ${product.current_stock} ${product.unit}`, product.rack ? `Rack ${product.rack}` : ''].filter(Boolean)
    });
  }
  return product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const { id: _id, created_at: _c, ...rest } = updates as any;

  let before: Product | undefined;
  const updated = await withTransaction([PRODUCTS, OUTBOX], async (tx, get) => {
    const existing = await get<Product>(PRODUCTS, id);
    before = existing;
    if (!existing) throw new Error('Product not found.');
    const now = new Date().toISOString();
    const next = normalizeProduct({ ...existing, ...rest, id, updated_at: now, details_updated_at: now });
    if (rest.sku && rest.sku !== existing.sku) await assertSkuFree(tx, rest.sku, id);
    tx.objectStore(PRODUCTS).put(next);
    queueInTx(tx, { kind: 'product', id });
    return next;
  });

  notifyOtherTabs({ kind: 'product', product: updated });

  if (before) {
    const wasActive = before.is_active !== false;
    if (wasActive && updated.is_active === false) {
      await logActivity('product.removed', `Removed ${updated.name}`, { product_id: id, product_name: updated.name });
    } else if (!wasActive && updated.is_active !== false) {
      await logActivity('product.restored', `Brought back ${updated.name}`, { product_id: id, product_name: updated.name });
    } else {
      const changes = diffProduct(before, updated);
      if (changes.length) {
        await logActivity('product.updated', `Edited ${updated.name}`, { product_id: id, product_name: updated.name, changes });
      }
    }
  }
  return updated;
}

export async function deleteOrDeactivateProduct(id: string, permanent = false): Promise<void> {
  if (permanent) {
    await withTransaction([PRODUCTS], async (tx) => {
      tx.objectStore(PRODUCTS).delete(id);
    });
    notifyOtherTabs({ kind: 'product_delete', id });
  } else {
    await updateProduct(id, { is_active: false });
  }
}
