import { supabase, sendRealtimeBroadcast } from '../lib/supabase';
import { Product, RealtimeStatus } from '../types/inventory';
import { INITIAL_PRODUCTS } from '../data/seedData';

const LOCAL_PRODUCTS_KEY = 'bahubali_products_data';
const CACHE_VERSION_KEY = 'bahubali_cache_v2_uuid';

export function getLocalProducts(): Product[] {
  try {
    // Automatic Purge of legacy 'p1' string ID cache
    const version = localStorage.getItem(CACHE_VERSION_KEY);
    if (!version) {
      localStorage.removeItem(LOCAL_PRODUCTS_KEY);
      localStorage.removeItem('bahubali_stock_transactions');
      localStorage.setItem(CACHE_VERSION_KEY, 'v2');
      return INITIAL_PRODUCTS;
    }

    const data = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    if (data) {
      const parsed: Product[] = JSON.parse(data);
      if (parsed.length > 0 && (parsed[0].id.startsWith('p1') || parsed[0].id.startsWith('p-'))) {
        localStorage.removeItem(LOCAL_PRODUCTS_KEY);
        return INITIAL_PRODUCTS;
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading local products:', err);
  }
  return INITIAL_PRODUCTS;
}

export function saveLocalProducts(products: Product[]) {
  try {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
    sendRealtimeBroadcast('PRODUCTS_UPDATED', products);
  } catch (err) {
    console.error('Error saving local products:', err);
  }
}

export async function fetchProducts(): Promise<{ products: Product[]; realtimeStatus: RealtimeStatus }> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        saveLocalProducts(data);
        return { products: data, realtimeStatus: 'connected' };
      } else {
        // Seed initial data into Supabase if empty
        const { error: seedErr } = await supabase.from('products').insert(INITIAL_PRODUCTS);
        if (!seedErr) {
          saveLocalProducts(INITIAL_PRODUCTS);
          return { products: INITIAL_PRODUCTS, realtimeStatus: 'connected' };
        }
      }
    } catch (err) {
      console.warn('Supabase fetch products error:', err);
      return { products: getLocalProducts(), realtimeStatus: 'reconnecting' };
    }
  }

  return { products: getLocalProducts(), realtimeStatus: 'local_demo' };
}

export async function createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const newProduct: Product = {
    ...productData,
    id: `b1000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (!error && data) {
        const local = getLocalProducts();
        saveLocalProducts([data, ...local]);
        return data;
      }
    } catch (err: any) {
      console.warn('Network fetch error during product creation:', err);
    }
  }

  // Fallback / Optimistic save
  const current = getLocalProducts();
  const updated = [newProduct, ...current];
  saveLocalProducts(updated);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>, productSku?: string): Promise<Product> {
  const now = new Date().toISOString();

  if (supabase) {
    try {
      // 1. Try matching by ID first
      let { data, error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .select();

      const skuToSearch = updates.sku || productSku;

      // 2. If ID match returned 0 rows, fallback to SKU match
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
        const updatedItem = data[0];
        // Fetch all fresh products from Supabase database to ensure 100% sync
        const freshRes = await supabase.from('products').select('*').order('name', { ascending: true });
        if (freshRes.data && freshRes.data.length > 0) {
          saveLocalProducts(freshRes.data);
          return freshRes.data.find((p) => p.id === updatedItem.id || p.sku === updatedItem.sku) || updatedItem;
        }
      }
    } catch (err: any) {
      console.warn('Network fetch error during stock update:', err);
    }
  }

  // Fallback / Optimistic update
  const current = getLocalProducts();
  let updatedProd: Product | null = null;
  const targetSku = updates.sku || productSku;

  const updatedList = current.map((p) => {
    if (p.id === id || (targetSku && p.sku === targetSku)) {
      updatedProd = { ...p, ...updates, updated_at: now };
      return updatedProd;
    }
    return p;
  });

  saveLocalProducts(updatedList);
  if (!updatedProd) throw new Error('Product not found');
  return updatedProd;
}

export async function deleteOrDeactivateProduct(id: string, permanent = false): Promise<void> {
  if (supabase) {
    if (permanent) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
    }
  }

  const current = getLocalProducts();
  const updated = permanent
    ? current.filter((p) => p.id !== id)
    : current.map((p) => (p.id === id ? { ...p, is_active: false, updated_at: new Date().toISOString() } : p));

  saveLocalProducts(updated);
}
