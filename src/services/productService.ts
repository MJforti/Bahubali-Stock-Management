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
  try {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (!error && data) {
      broadcastGlobalSync('PRODUCT_CREATE', data);
      return data;
    }
  } catch (err: any) {
    console.warn('Supabase create product network warning:', err);
  }

  const fallback: Product = {
    ...productData,
    id: `b1000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  broadcastGlobalSync('PRODUCT_CREATE', fallback);
  return fallback;
}

export async function updateProduct(id: string, updates: Partial<Product>, productSku?: string): Promise<Product> {
  const now = new Date().toISOString();

  try {
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

    if (data && data.length > 0) {
      const updatedProduct = data[0];
      broadcastGlobalSync('PRODUCT_UPDATE', updatedProduct);
      return updatedProduct;
    }
  } catch (err: any) {
    console.warn('Supabase update product network warning:', err);
  }

  const updatedProduct = { id, is_active: true, ...updates, updated_at: now } as Product;
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
