import { supabase } from '../lib/supabase';
import { Product, RealtimeStatus } from '../types/inventory';
import { broadcastGlobalSync } from './realtimeSync';

/** Postgres NUMERIC columns can arrive as strings; normalise them. */
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

function toError(error: { message?: string } | null | undefined, fallback: string): Error {
  return new Error(error?.message ? `${fallback}: ${error.message}` : fallback);
}

/**
 * Loads all products from the central database. Throws on failure so the UI
 * can show the connection problem instead of silently displaying demo data.
 */
export async function fetchProducts(): Promise<{ products: Product[]; realtimeStatus: RealtimeStatus }> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw toError(error, 'Could not load products');

  return { products: (data || []).map(normalizeProduct), realtimeStatus: 'connected' };
}

export async function createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error || !data) throw toError(error, 'Could not save product');

  const created = normalizeProduct(data);
  broadcastGlobalSync('PRODUCT_CREATE', created);
  return created;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  // Never send identity/timestamp columns back to the database
  const { id: _id, created_at: _c, ...rest } = updates as any;

  const { data, error } = await supabase
    .from('products')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw toError(error, 'Could not update product');

  const updated = normalizeProduct(data);
  broadcastGlobalSync('PRODUCT_UPDATE', updated);
  return updated;
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
