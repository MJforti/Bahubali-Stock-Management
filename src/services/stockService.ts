import { supabase } from '../lib/supabase';
import { StockTransaction, TransactionType, Product } from '../types/inventory';
import { updateProduct } from './productService';
import { broadcastGlobalSync } from './realtimeSync';

export async function fetchStockTransactions(): Promise<StockTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('stock_transactions')
      .select(`
        *,
        products (
          name,
          sku,
          image_url,
          brand
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map((t: any) => ({
        ...t,
        product_name: t.products?.name || t.product_name || 'Unknown Product',
        product_sku: t.products?.sku || t.product_sku || '',
        product_image: t.products?.image_url || t.product_image || '',
        product_brand: t.products?.brand || t.product_brand || ''
      }));
    }
  } catch (err) {
    console.error('Supabase transactions fetch failed:', err);
  }

  return [];
}

export async function recordStockMovement(params: {
  product: Product;
  type: TransactionType;
  quantity: number;
  reason?: string;
  reference?: string;
  userName: string;
}): Promise<{ product: Product; transaction: StockTransaction }> {
  const { product, type, quantity, reason, reference, userName } = params;

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  if (type === 'OUT' && product.current_stock < quantity) {
    throw new Error(`Cannot issue ${quantity} ${product.unit}(s). Current stock is only ${product.current_stock} ${product.unit}(s).`);
  }

  if (type === 'ADJUSTMENT' && (!reason || reason.trim().length === 0)) {
    throw new Error('A mandatory audit reason is required for manual stock adjustments.');
  }

  // 1. ATOMIC SUPABASE RPC CALL
  try {
    const { data: rpcProduct, error: rpcError } = await supabase.rpc('record_stock_change', {
      p_product_id: product.id,
      p_type: type,
      p_quantity: quantity,
      p_reason: reason || (type === 'IN' ? 'Stock In Addition' : 'Stock Out Issue'),
      p_reference: reference || '',
      p_user_name: userName || 'Admin'
    });

    if (!rpcError && rpcProduct) {
      console.log('✅ Stock change permanently saved via Supabase RPC:', rpcProduct);
      const updated = rpcProduct as Product;
      
      const createdTx: StockTransaction = {
        id: `tx-${Date.now()}`,
        product_id: updated.id,
        type,
        quantity: type === 'ADJUSTMENT' ? Math.abs(quantity - product.current_stock) : quantity,
        previous_stock: product.current_stock,
        new_stock: updated.current_stock,
        reason: reason || '',
        reference: reference || '',
        user_name: userName,
        created_at: new Date().toISOString(),
        product_name: updated.name,
        product_sku: updated.sku,
        product_image: updated.image_url,
        product_brand: updated.brand
      };

      broadcastGlobalSync('STOCK_UPDATE', { productId: updated.id, newStock: updated.current_stock });
      return { product: updated, transaction: createdTx };
    } else {
      console.warn('RPC record_stock_change failed, using fallback updateProduct:', rpcError);
    }
  } catch (rpcErr) {
    console.warn('RPC execution exception, using fallback updateProduct:', rpcErr);
  }

  // 2. FALLBACK MANUAL UPDATE
  let newStock = product.current_stock;
  if (type === 'IN') newStock += quantity;
  else if (type === 'OUT') newStock -= quantity;
  else if (type === 'ADJUSTMENT') newStock = quantity;

  const updatedProduct = await updateProduct(product.id, { current_stock: newStock }, product.sku);

  const transactionData = {
    product_id: updatedProduct.id,
    type,
    quantity: type === 'ADJUSTMENT' ? Math.abs(newStock - product.current_stock) : quantity,
    previous_stock: product.current_stock,
    new_stock: newStock,
    reason: reason || (type === 'IN' ? 'Stock In Addition' : 'Stock Out Issue'),
    reference: reference || '',
    user_name: userName
  };

  let createdTransaction: StockTransaction = {
    ...transactionData,
    id: `tx-${Date.now()}`,
    created_at: new Date().toISOString(),
    product_name: updatedProduct.name,
    product_sku: updatedProduct.sku,
    product_image: updatedProduct.image_url,
    product_brand: updatedProduct.brand
  };

  try {
    const { data } = await supabase
      .from('stock_transactions')
      .insert([transactionData])
      .select()
      .single();

    if (data) {
      createdTransaction = { ...createdTransaction, id: data.id };
    }
  } catch (err: any) {
    console.warn('Supabase stock transaction logging network warning:', err);
  }

  broadcastGlobalSync('STOCK_UPDATE', { productId: updatedProduct.id, newStock });
  return { product: updatedProduct, transaction: createdTransaction };
}
