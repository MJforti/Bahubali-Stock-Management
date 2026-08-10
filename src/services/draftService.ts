import { supabase } from '../lib/supabase';
import { Product, StockTransaction } from '../types/inventory';
import { updateProduct, createProduct, saveLocalProducts, getLocalProducts } from './productService';
import { saveLocalTransactions, getLocalTransactions } from './stockService';

export interface ProductDraft {
  id: string;
  product_id: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'STOCK_MOVEMENT';
  draft_payload: any;
  change_summary: string;
  created_at: string;
  created_by: string;
}

export interface InventoryVersion {
  version: number;
  published_by: string;
  published_at: string;
  changes_count: number;
  note: string;
  changes_summary: Array<{ action: string; summary: string }>;
}

const LOCAL_DRAFTS_KEY = 'bahubali_pending_drafts';

export function getLocalDrafts(): ProductDraft[] {
  try {
    const data = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local drafts:', err);
  }
  return [];
}

export function saveLocalDrafts(drafts: ProductDraft[]) {
  try {
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error('Error saving local drafts:', err);
  }
}

export async function fetchProductDrafts(): Promise<ProductDraft[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('product_drafts')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        saveLocalDrafts(data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetch drafts error, using local drafts:', err);
    }
  }
  return getLocalDrafts();
}

export async function addProductDraft(
  productId: string,
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STOCK_MOVEMENT',
  draftPayload: any,
  changeSummary: string,
  createdBy = 'Admin'
): Promise<ProductDraft> {
  const newDraft: ProductDraft = {
    id: `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    product_id: productId,
    action_type: actionType,
    draft_payload: draftPayload,
    change_summary: changeSummary,
    created_at: new Date().toISOString(),
    created_by: createdBy
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('product_drafts')
        .insert([{
          product_id: productId,
          action_type: actionType,
          draft_payload: draftPayload,
          change_summary: changeSummary,
          created_by: createdBy
        }])
        .select()
        .single();

      if (!error && data) {
        const local = getLocalDrafts();
        const updated = [...local, data];
        saveLocalDrafts(updated);
        return data;
      }
    } catch (err) {
      console.warn('Supabase insert draft error:', err);
    }
  }

  const local = getLocalDrafts();
  const updated = [...local, newDraft];
  saveLocalDrafts(updated);
  return newDraft;
}

export async function discardAllDrafts(): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('product_drafts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (err) {
      console.warn('Supabase discard drafts error:', err);
    }
  }
  localStorage.removeItem(LOCAL_DRAFTS_KEY);
}

export async function publishAllDrafts(
  publishedBy = 'Admin',
  note = 'Standard Inventory Update'
): Promise<{ version: number; count: number }> {
  const drafts = await fetchProductDrafts();
  if (drafts.length === 0) {
    return { version: 1, count: 0 };
  }

  if (supabase) {
    try {
      // 1. Attempt Atomic RPC publication in Supabase PostgreSQL
      const { data, error } = await supabase.rpc('publish_inventory_drafts', {
        p_published_by: publishedBy,
        p_note: note
      });

      if (!error && typeof data === 'number') {
        localStorage.removeItem(LOCAL_DRAFTS_KEY);
        return { version: data, count: drafts.length };
      }
    } catch (err) {
      console.warn('Supabase RPC publish_inventory_drafts error, executing batch publication fallback:', err);
    }
  }

  // Fallback Batch Publication
  for (const d of drafts) {
    const payload = d.draft_payload;
    if (d.action_type === 'CREATE') {
      await createProduct(payload);
    } else if (d.action_type === 'UPDATE' || d.action_type === 'STOCK_MOVEMENT') {
      await updateProduct(d.product_id, payload, payload.sku);
    }
  }

  await discardAllDrafts();
  return { version: Date.now(), count: drafts.length };
}

export async function fetchPublishHistory(): Promise<InventoryVersion[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('inventory_versions')
        .select('*')
        .order('version', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetch version history error:', err);
    }
  }

  return [
    {
      version: 1,
      published_by: 'System Initializer',
      published_at: new Date(Date.now() - 86400000).toISOString(),
      changes_count: 12,
      note: 'Initial Hardware Inventory Baseline',
      changes_summary: [{ action: 'CREATE', summary: 'Baseline inventory seeded' }]
    }
  ];
}
