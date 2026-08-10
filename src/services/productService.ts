import { supabase, localBroadcastChannel, sendRealtimeBroadcast } from '../lib/supabase';
import { Product, RealtimeStatus } from '../types/inventory';
import { INITIAL_PRODUCTS } from '../data/seedData';

const LOCAL_PRODUCTS_KEY = 'bahubali_products_data';

export function getLocalProducts(): Product[] {
  try {
    const data = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading local products:', err);
  }
  // Initialize with seed data if empty
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
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
      console.warn('Supabase fetch failed, falling back to local dataset:', err);
      return { products: getLocalProducts(), realtimeStatus: 'reconnecting' };
    }
  }

  return { products: getLocalProducts(), realtimeStatus: 'local_demo' };
}

export async function createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const newProduct: Product = {
    ...productData,
    id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
    } catch (err) {
      console.error('Supabase create product error:', err);
    }
  }

  // Local fallback
  const current = getLocalProducts();
  const updated = [newProduct, ...current];
  saveLocalProducts(updated);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const local = getLocalProducts();
        const updated = local.map((p) => (p.id === id ? data : p));
        saveLocalProducts(updated);
        return data;
      }
    } catch (err) {
      console.error('Supabase update product error:', err);
    }
  }

  // Local fallback
  const current = getLocalProducts();
  let updatedProd: Product | null = null;

  const updatedList = current.map((p) => {
    if (p.id === id) {
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
    try {
      if (permanent) {
        await supabase.from('products').delete().eq('id', id);
      } else {
        await supabase.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
      }
    } catch (err) {
      console.error('Supabase delete error:', err);
    }
  }

  const current = getLocalProducts();
  const updated = permanent
    ? current.filter((p) => p.id !== id)
    : current.map((p) => (p.id === id ? { ...p, is_active: false, updated_at: new Date().toISOString() } : p));

  saveLocalProducts(updated);
}
