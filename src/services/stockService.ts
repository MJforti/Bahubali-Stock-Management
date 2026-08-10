import { supabase, localBroadcastChannel, sendRealtimeBroadcast } from '../lib/supabase';
import { StockTransaction, TransactionType, Product } from '../types/inventory';
import { INITIAL_TRANSACTIONS } from '../data/seedData';
import { updateProduct, getLocalProducts } from './productService';

const LOCAL_TRANSACTIONS_KEY = 'bahubali_stock_transactions';

export function getLocalTransactions(): StockTransaction[] {
  try {
    const data = localStorage.getItem(LOCAL_TRANSACTIONS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading stock transactions:', err);
  }
  localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
  return INITIAL_TRANSACTIONS;
}

export function saveLocalTransactions(transactions: StockTransaction[]) {
  try {
    localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(transactions));
    sendRealtimeBroadcast('TRANSACTIONS_UPDATED', transactions);
  } catch (err) {
    console.error('Error saving stock transactions:', err);
  }
}

export async function fetchStockTransactions(): Promise<StockTransaction[]> {
  if (supabase) {
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
        const formatted: StockTransaction[] = data.map((t: any) => ({
          ...t,
          product_name: t.products?.name || t.product_name || 'Unknown Product',
          product_sku: t.products?.sku || t.product_sku || '',
          product_image: t.products?.image_url || t.product_image || '',
          product_brand: t.products?.brand || t.product_brand || ''
        }));
        saveLocalTransactions(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase transactions fetch failed, using local audit log:', err);
    }
  }

  return getLocalTransactions();
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

  let newStock = product.current_stock;
  if (type === 'IN') {
    newStock += quantity;
  } else if (type === 'OUT') {
    if (product.current_stock < quantity) {
      throw new Error(`Cannot issue ${quantity} ${product.unit}(s). Current stock is only ${product.current_stock} ${product.unit}(s).`);
    }
    newStock -= quantity;
  } else if (type === 'ADJUSTMENT') {
    newStock = quantity; // quantity represents the target count in adjustment mode
    if (!reason || reason.trim().length === 0) {
      throw new Error('A mandatory audit reason is required for manual stock adjustments.');
    }
  }

  const transactionData: Omit<StockTransaction, 'id'> = {
    product_id: product.id,
    type,
    quantity: type === 'ADJUSTMENT' ? Math.abs(newStock - product.current_stock) : quantity,
    previous_stock: product.current_stock,
    new_stock: newStock,
    reason: reason || (type === 'IN' ? 'Stock In Addition' : 'Stock Out Issue'),
    reference: reference || '',
    user_name: userName,
    created_at: new Date().toISOString(),
    product_name: product.name,
    product_sku: product.sku,
    product_image: product.image_url,
    product_brand: product.brand
  };

  // Update Product Stock
  const updatedProduct = await updateProduct(product.id, { current_stock: newStock }, product.sku);

  // Record Transaction
  let createdTransaction: StockTransaction = {
    ...transactionData,
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .insert([{
          product_id: updatedProduct.id,
          type: transactionData.type,
          quantity: transactionData.quantity,
          previous_stock: transactionData.previous_stock,
          new_stock: transactionData.new_stock,
          reason: transactionData.reason,
          reference: transactionData.reference,
          user_name: transactionData.user_name
        }])
        .select()
        .single();

      if (!error && data) {
        createdTransaction = {
          ...createdTransaction,
          id: data.id
        };
      }
    } catch (err) {
      console.error('Supabase transaction insert failed:', err);
    }
  }

  const localTx = getLocalTransactions();
  saveLocalTransactions([createdTransaction, ...localTx]);

  return { product: updatedProduct, transaction: createdTransaction };
}
