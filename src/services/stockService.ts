import { supabase } from '../lib/supabase';
import { StockTransaction, TransactionType, Product } from '../types/inventory';
import { normalizeProduct, updateProduct } from './productService';
import { broadcastGlobalSync } from './realtimeSync';

function normalizeTransaction(t: any, prod?: any): StockTransaction {
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
  const { data, error } = await supabase
    .from('stock_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw new Error(`Could not load stock history: ${error.message}`);
  if (!data || data.length === 0) return [];

  const { data: prodData } = await supabase.from('products').select('id, name, sku, brand, image_url');
  const prodMap = new Map((prodData || []).map((p: any) => [p.id, p]));

  return data.map((t: any) => normalizeTransaction(t, prodMap.get(t.product_id)));
}

/** True when the error means the RPC is not installed in the database (schema.sql not run). */
function isMissingFunctionError(error: any): boolean {
  const code = error?.code;
  return code === 'PGRST202' || code === '42883';
}

export async function recordStockMovement(params: {
  product: Product;
  type: TransactionType;
  quantity: number;
  reason?: string;
  reference?: string;
  userName: string;
}): Promise<{ product: Product; transaction: StockTransaction }> {
  const { product, reason, reference, userName } = params;
  const type = params.type.toUpperCase().trim() as TransactionType;

  const currentStockNum = Number(product.current_stock) || 0;
  const qtyNum = Number(params.quantity);

  if (!Number.isFinite(qtyNum) || qtyNum < 0 || (type !== 'ADJUSTMENT' && qtyNum === 0)) {
    throw new Error('Quantity must be greater than zero.');
  }

  if (type === 'OUT' && currentStockNum < qtyNum) {
    throw new Error(`Cannot issue ${qtyNum} ${product.unit}(s). Current stock is only ${currentStockNum} ${product.unit}(s).`);
  }

  if (type === 'ADJUSTMENT' && (!reason || reason.trim().length === 0)) {
    throw new Error('A mandatory audit reason is required for manual stock adjustments.');
  }

  const finalReason = reason || (type === 'IN' ? 'Stock In Addition' : type === 'OUT' ? 'Stock Out Issue' : '');

  // 1. Atomic server-side update (locks the row, validates, writes product + history in one transaction)
  const { data: rpcData, error: rpcError } = await supabase.rpc('record_stock_change', {
    p_product_id: product.id,
    p_type: type,
    p_quantity: qtyNum,
    p_reason: finalReason,
    p_reference: reference || '',
    p_user_name: userName || 'Staff'
  });

  if (!rpcError && rpcData) {
    // Newer RPC returns { product, transaction }; older one returns just the product row.
    const rawProduct = (rpcData as any).product ?? rpcData;
    const rawTx = (rpcData as any).transaction;
    const updated = normalizeProduct(rawProduct);

    const transaction = rawTx
      ? normalizeTransaction(rawTx, updated)
      : normalizeTransaction(
          {
            id: `tx-${Date.now()}`,
            product_id: updated.id,
            type,
            quantity: type === 'ADJUSTMENT' ? Math.abs(updated.current_stock - currentStockNum) : qtyNum,
            previous_stock: currentStockNum,
            new_stock: updated.current_stock,
            reason: finalReason,
            reference: reference || '',
            user_name: userName,
            created_at: new Date().toISOString()
          },
          updated
        );

    broadcastGlobalSync('STOCK_UPDATE', { productId: updated.id, newStock: updated.current_stock });
    return { product: updated, transaction };
  }

  if (rpcError && !isMissingFunctionError(rpcError)) {
    // Real failure (e.g. insufficient stock, network, permissions) — never fake success.
    throw new Error(rpcError.message || 'Something went wrong. Please try again.');
  }

  console.warn('record_stock_change RPC not installed; run supabase/schema.sql. Using direct update.');

  // 2. Fallback for databases without the RPC: direct update + history row
  let newStock = currentStockNum;
  if (type === 'IN') newStock = currentStockNum + qtyNum;
  else if (type === 'OUT') newStock = currentStockNum - qtyNum;
  else newStock = qtyNum;

  const updatedProduct = await updateProduct(product.id, { current_stock: newStock });

  const transactionData = {
    product_id: updatedProduct.id,
    type,
    quantity: type === 'ADJUSTMENT' ? Math.abs(newStock - currentStockNum) : qtyNum,
    previous_stock: currentStockNum,
    new_stock: newStock,
    reason: finalReason,
    reference: reference || '',
    user_name: userName
  };

  const { data: txRow, error: txError } = await supabase
    .from('stock_transactions')
    .insert([transactionData])
    .select()
    .single();

  if (txError || !txRow) {
    throw new Error(`Stock updated, but history entry failed: ${txError?.message || 'unknown error'}`);
  }

  broadcastGlobalSync('STOCK_UPDATE', { productId: updatedProduct.id, newStock });
  return { product: updatedProduct, transaction: normalizeTransaction(txRow, updatedProduct) };
}
