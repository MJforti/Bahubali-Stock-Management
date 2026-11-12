import { StockTransaction, TransactionType, Product } from '../types/inventory';
import { OUTBOX, queueInTx, PRODUCTS, TRANSACTIONS, getAll, withTransaction, newId, notifyOtherTabs } from '../lib/localDb';
import { normalizeProduct } from './productService';

function withProductInfo(t: StockTransaction, prod?: Product): StockTransaction {
  return {
    ...t,
    quantity: Number(t.quantity) || 0,
    previous_stock: Number(t.previous_stock) || 0,
    new_stock: Number(t.new_stock) || 0,
    product_name: prod?.name || t.product_name || 'Hardware Item',
    product_sku: prod?.sku || t.product_sku || '',
    product_image: prod?.image_url || t.product_image || '',
    product_brand: prod?.brand || t.product_brand || ''
  };
}

export async function fetchStockTransactions(): Promise<StockTransaction[]> {
  const [txs, prods] = await Promise.all([getAll<StockTransaction>(TRANSACTIONS), getAll<Product>(PRODUCTS)]);
  const prodMap = new Map(prods.map((p) => [p.id, p]));
  return txs
    .map((t) => withProductInfo(t, prodMap.get(t.product_id)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Atomically updates stock and writes the history row in a single IndexedDB
 * transaction, reading the latest stored stock (not the possibly stale UI copy).
 */
export async function recordStockMovement(params: {
  product: Product;
  type: TransactionType;
  quantity: number;
  reason?: string;
  reference?: string;
  userName: string;
}): Promise<{ product: Product; transaction: StockTransaction }> {
  const { reason, reference, userName } = params;
  const type = params.type.toUpperCase().trim() as TransactionType;
  const qty = Number(params.quantity);

  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) throw new Error(`Invalid stock movement type: ${type}`);
  if (!Number.isFinite(qty) || qty < 0 || (type !== 'ADJUSTMENT' && qty === 0)) {
    throw new Error('Quantity must be greater than zero.');
  }
  if (type === 'ADJUSTMENT' && !reason?.trim()) {
    throw new Error('A mandatory audit reason is required for manual stock adjustments.');
  }

  const finalReason = (reason || '').trim();

  const result = await withTransaction([PRODUCTS, TRANSACTIONS, OUTBOX], async (tx, get) => {
    const stored = await get<Product>(PRODUCTS, params.product.id);
    if (!stored) throw new Error('Product not found.');
    const product = normalizeProduct(stored);
    const oldStock = product.current_stock;

    let newStock: number;
    let txQty: number;
    if (type === 'IN') {
      newStock = oldStock + qty;
      txQty = qty;
    } else if (type === 'OUT') {
      if (qty > oldStock) {
        throw new Error(`Cannot issue ${qty} ${product.unit}(s). Current stock is only ${oldStock} ${product.unit}(s).`);
      }
      newStock = oldStock - qty;
      txQty = qty;
    } else {
      newStock = qty;
      txQty = Math.abs(qty - oldStock);
    }

    const now = new Date().toISOString();
    const updated: Product = { ...product, current_stock: newStock, updated_at: now, updated_by: userName };
    const transaction: StockTransaction = {
      id: newId(),
      product_id: product.id,
      type,
      quantity: txQty,
      previous_stock: oldStock,
      new_stock: newStock,
      reason: finalReason,
      reference: reference || '',
      user_name: userName || 'Staff',
      created_at: now
    };

    tx.objectStore(PRODUCTS).put(updated);
    tx.objectStore(TRANSACTIONS).put(transaction);
    queueInTx(tx, { kind: 'movement', id: transaction.id });
    return { product: updated, transaction: withProductInfo(transaction, updated) };
  });

  notifyOtherTabs({ kind: 'product', product: result.product });
  notifyOtherTabs({ kind: 'transaction', transaction: result.transaction });
  return result;
}
