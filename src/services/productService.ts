import { supabase } from '../lib/supabase';
import { Product, RealtimeStatus } from '../types/inventory';
import { INITIAL_PRODUCTS } from '../data/seedData';
import { broadcastGlobalSync } from './realtimeSync';

export async function fetchProducts(): Promise<{ products: Product[]; realtimeStatus: RealtimeStatus }> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      return { products: data, realtimeStatus: 'connected' };
    } else {
      // Seed baseline products directly into central database if empty
      const { data: seedData, error: seedErr } = await supabase
        .from('products')
        .insert(INITIAL_PRODUCTS)
        .select();

      if (!seedErr && seedData) {
        return { products: seedData, realtimeStatus: 'connected' };
      }
    }
  } catch (err) {
    console.error('Supabase fetch products error:', err);
    return { products: INITIAL_PRODUCTS, realtimeStatus: 'reconnecting' };
  }

  return { products: INITIAL_PRODUCTS, realtimeStatus: 'connected' };
}

export async function createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error) {
    console.error('Supabase product creation error:', error);
    throw new Error(error.message);
  }

  broadcastGlobalSync('PRODUCT_CREATE', data);
  return data;
}

export async function updateProduct(id: string, updates: Partial<Product>, productSku?: string): Promise<Product> {
  const now = new Date().toISOString();

  // 1. Update by ID
  let { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: now })
    .eq('id', id)
    .select();

  const skuToSearch = updates.sku || productSku;

  // 2. Fallback to SKU match if ID returned 0 rows
  if ((!data || data.length === 0 || error) && skuToSearch) {
    const skuRes = await supabase
      .from('products')
      .update({ ...updates, updated_at: now })
      .eq('sku', skuToSearch)
      .select();

    if (skuRes.data && skuRes.data.length > 0) {
      data = skuRes.data;
    }
  }

  if (error && (!data || data.length === 0)) {
    console.error('Supabase product update error:', error);
    throw new Error(error.message);
  }

  const updatedProduct = data && data.length > 0 ? data[0] : ({ id, ...updates } as Product);
  broadcastGlobalSync('PRODUCT_UPDATE', updatedProduct);
  return updatedProduct;
}

export async function deleteOrDeactivateProduct(id: string, permanent = false): Promise<void> {
  if (permanent) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  broadcastGlobalSync('PRODUCT_DELETE', { id, permanent });
}
