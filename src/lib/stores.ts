/**
 * Stores (shops and godowns). Shared by every phone through sync.
 * Stock is kept per store: product.stock_by_store[storeId].
 */
import { MAIN_STORE_ID, Product, Store } from '../types/inventory';
import { OUTBOX, STORES, getAll, newId, notifyOtherTabs, queueInTx, withTransaction } from './localDb';

export const ALL_STORES = 'all';
export type StoreScope = typeof ALL_STORES | string;

/** Fired when the list of stores changes (here, another tab, or sync). */
export const STORES_CHANGED_EVENT = 'bahubali-stores';

export async function fetchStores(): Promise<Store[]> {
  const rows = await getAll<Store>(STORES);
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function changed() {
  notifyOtherTabs({ kind: 'reload' });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STORES_CHANGED_EVENT));
}

const cleanStoreName = (n: string) => n.replace(/\s+/g, ' ').trim().slice(0, 60);

async function save(store: Store) {
  await withTransaction([STORES, OUTBOX], async (tx) => {
    tx.objectStore(STORES).put(store);
    queueInTx(tx, { kind: 'store', id: store.id });
  });
  changed();
  return store;
}

export async function addStore(name: string, existing: Store[]): Promise<Store> {
  const clean = cleanStoreName(name);
  if (!clean) throw new Error('Type a store name');
  if (existing.some((s) => s.is_active && s.name.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`${clean} already exists`);
  }
  const order = Math.max(0, ...existing.map((s) => s.sort_order)) + 1;
  return save({ id: newId(), name: clean, is_active: true, sort_order: order, changed_at: new Date().toISOString() });
}

export async function renameStore(store: Store, name: string, existing: Store[]): Promise<Store> {
  const clean = cleanStoreName(name);
  if (!clean) throw new Error('Type a store name');
  if (existing.some((s) => s.id !== store.id && s.is_active && s.name.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`${clean} already exists`);
  }
  return save({ ...store, name: clean, changed_at: new Date().toISOString() });
}

export async function removeStore(store: Store): Promise<Store> {
  if (store.id === MAIN_STORE_ID) throw new Error('Main Store can be renamed but not removed');
  return save({ ...store, is_active: false, changed_at: new Date().toISOString() });
}

/** Store rows pulled from the central database (no re-upload). */
export async function putStoresFromCloud(rows: Store[]) {
  await withTransaction([STORES], async (tx, get) => {
    for (const r of rows) {
      const local = await get<Store>(STORES, r.id);
      // Keep a newer local change that is still waiting to be sent
      if (local && new Date(local.changed_at).getTime() > new Date(r.changed_at).getTime()) continue;
      tx.objectStore(STORES).put(r);
    }
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STORES_CHANGED_EVENT));
}

// ---------- Stock per store ----------

/** Stock of a product in one store, or the total for all stores. */
export function stockIn(p: Product, scope: StoreScope): number {
  if (scope === ALL_STORES) return Number(p.current_stock) || 0;
  const map = p.stock_by_store;
  // Products from before stores existed: all their stock is in Main Store
  if (!map || Object.keys(map).length === 0) return scope === MAIN_STORE_ID ? Number(p.current_stock) || 0 : 0;
  return Number(map[scope]) || 0;
}

/** Per-store stock map with legacy products treated as all-in-Main. */
export function stockMap(p: Product): Record<string, number> {
  const map = p.stock_by_store;
  if (!map || Object.keys(map).length === 0) return { [MAIN_STORE_ID]: Number(p.current_stock) || 0 };
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Number(v) || 0]));
}

export function totalOf(map: Record<string, number>) {
  return Object.values(map).reduce((a, b) => a + (Number(b) || 0), 0);
}

// ---------- Which store this phone is looking at ----------

const SCOPE_KEY = 'bahubali_store_scope';

export function getSavedScope(): StoreScope {
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    return v ? (JSON.parse(v) as StoreScope) : ALL_STORES;
  } catch {
    return ALL_STORES;
  }
}

export function saveScope(scope: StoreScope) {
  try {
    localStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
  } catch {
    /* ignore */
  }
}
