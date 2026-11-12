/**
 * Offline database for Bahubali Enterprises.
 *
 * All products and stock history live in the browser's IndexedDB on this
 * device. Nothing is sent over the network. Other open tabs/windows of the
 * app on the same device are kept in sync through BroadcastChannel.
 */
import { Product, StockTransaction } from '../types/inventory';
import { INITIAL_PRODUCTS } from '../data/seedData';

const DB_NAME = 'bahubali_inventory';
const DB_VERSION = 2; // 2: activity log
export const PRODUCTS = 'products';
export const TRANSACTIONS = 'stock_transactions';
export const ACTIVITY = 'activity';
const META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Database transaction aborted'));
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('This browser does not support offline storage (IndexedDB).'));
        return;
      }
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(PRODUCTS)) {
          const s = db.createObjectStore(PRODUCTS, { keyPath: 'id' });
          s.createIndex('sku', 'sku', { unique: true });
        }
        if (!db.objectStoreNames.contains(TRANSACTIONS)) {
          const s = db.createObjectStore(TRANSACTIONS, { keyPath: 'id' });
          s.createIndex('product_id', 'product_id');
          s.createIndex('created_at', 'created_at');
        }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        if (!db.objectStoreNames.contains(ACTIVITY)) {
          const s = db.createObjectStore(ACTIVITY, { keyPath: 'id' });
          s.createIndex('created_at', 'created_at');
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    }).then(async (db) => {
      await seedIfNeeded(db);
      // Ask the browser not to evict our data under storage pressure.
      try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
      return db;
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function seedIfNeeded(db: IDBDatabase) {
  const tx = db.transaction([PRODUCTS, META], 'readwrite');
  const seeded = await req(tx.objectStore(META).get('seeded'));
  if (!seeded) {
    INITIAL_PRODUCTS.forEach((p) => tx.objectStore(PRODUCTS).put(p));
    tx.objectStore(META).put(true, 'seeded');
  }
  await txDone(tx);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return req(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function getOne<T>(store: string, id: string): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
}

/** Runs `fn` inside one atomic read-write transaction across the given stores. */
export async function withTransaction<R>(
  stores: string[],
  fn: (tx: IDBTransaction, get: <T>(store: string, key: string) => Promise<T | undefined>) => Promise<R>
): Promise<R> {
  const db = await openDb();
  const tx = db.transaction(stores, 'readwrite');
  const done = txDone(tx);
  const get = <T,>(store: string, key: string) => req(tx.objectStore(store).get(key)) as Promise<T | undefined>;
  let result: R;
  try {
    result = await fn(tx, get);
  } catch (err) {
    try { tx.abort(); } catch { /* already finished */ }
    await done.catch(() => {});
    throw err;
  }
  await done;
  return result;
}

/** Throws a friendly error if a different product already uses this SKU. */
export async function assertSkuFree(tx: IDBTransaction, sku: string, selfId?: string) {
  const existing = (await req(tx.objectStore(PRODUCTS).index('sku').get(sku))) as Product | undefined;
  if (existing && existing.id !== selfId) {
    throw new Error(`SKU "${sku}" is already used by "${existing.name}".`);
  }
}

// ---------- Backup / restore ----------

export interface BackupFile {
  app: 'bahubali-stock-management';
  version: 1;
  exported_at: string;
  products: Product[];
  stock_transactions: StockTransaction[];
  activity?: unknown[];
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'bahubali-stock-management',
    version: 1,
    exported_at: new Date().toISOString(),
    products: await getAll<Product>(PRODUCTS),
    stock_transactions: await getAll<StockTransaction>(TRANSACTIONS),
    activity: await getAll<unknown>(ACTIVITY)
  };
}

export async function restoreBackup(data: BackupFile): Promise<void> {
  if (!data || data.app !== 'bahubali-stock-management' || !Array.isArray(data.products) || !Array.isArray(data.stock_transactions)) {
    throw new Error('This is not a valid Bahubali backup file.');
  }
  await withTransaction([PRODUCTS, TRANSACTIONS, ACTIVITY, META], async (tx) => {
    tx.objectStore(PRODUCTS).clear();
    tx.objectStore(TRANSACTIONS).clear();
    data.products.forEach((p) => tx.objectStore(PRODUCTS).put(p));
    data.stock_transactions.forEach((t) => tx.objectStore(TRANSACTIONS).put(t));
    // Older backups have no activity log: keep this phone's log rather than wiping it
    if (Array.isArray(data.activity)) {
      tx.objectStore(ACTIVITY).clear();
      data.activity.forEach((a: any) => a && typeof a.id === 'string' && tx.objectStore(ACTIVITY).put(a));
    }
    tx.objectStore(META).put(true, 'seeded');
  });
}

// ---------- Cross-tab sync on this device ----------

export type LocalChange =
  | { kind: 'product'; product: Product }
  | { kind: 'product_delete'; id: string }
  | { kind: 'transaction'; transaction: StockTransaction }
  | { kind: 'activity' }
  | { kind: 'reload' };

const channel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('bahubali_inventory_sync') : null;

export function notifyOtherTabs(change: LocalChange) {
  try { channel?.postMessage(change); } catch { /* ignore */ }
}

export function onOtherTabChange(cb: (change: LocalChange) => void): () => void {
  if (!channel) return () => {};
  const handler = (e: MessageEvent) => cb(e.data as LocalChange);
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

// ---------- Admin passcode (offline) ----------

export async function verifyAdminPasscode(inputCode: string): Promise<boolean> {
  const code = inputCode.trim();
  return code === '9988' || code === '1234';
}
