/**
 * Local database for Bahubali Enterprises (IndexedDB).
 *
 * The app always reads and writes this local copy, so it works with no
 * internet. Every change is also queued in the outbox and sent to the
 * central Supabase database by lib/sync.ts whenever the phone is online.
 * Other open tabs on the same device are kept in sync with BroadcastChannel.
 */
import { Product, StockTransaction } from '../types/inventory';
import { INITIAL_PRODUCTS } from '../data/seedData';

const DB_NAME = 'bahubali_inventory';
const DB_VERSION = 3; // 2: activity log, 3: outbox for cloud sync
export const PRODUCTS = 'products';
export const TRANSACTIONS = 'stock_transactions';
export const ACTIVITY = 'activity';
export const OUTBOX = 'outbox';
export const META = 'meta';

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
        if (!db.objectStoreNames.contains(OUTBOX)) {
          db.createObjectStore(OUTBOX, { keyPath: 'seq', autoIncrement: true });
        }
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
  // Older browsers: build a random version-4 UUID by hand
  const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  h[12] = '4';
  h[16] = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8).join('')}-${h.slice(8, 12).join('')}-${h.slice(12, 16).join('')}-${h.slice(16, 20).join('')}-${h.slice(20).join('')}`;
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

// ---------- Outbox: changes waiting to be sent to the central database ----------

export type OutboxOp =
  | { kind: 'product'; id: string }
  | { kind: 'movement'; id: string }
  | { kind: 'activity'; id: string }
  | { kind: 'staff'; name: string };

/** Queue a change inside an existing write transaction (so it can't be lost). */
export function queueInTx(tx: IDBTransaction, op: OutboxOp) {
  tx.objectStore(OUTBOX).add({ ...op, queued_at: Date.now() });
  pendingHook();
}

/** Queue changes in their own transaction. */
export async function queue(ops: OutboxOp[]) {
  if (!ops.length) return;
  await withTransaction([OUTBOX], async (tx) => {
    ops.forEach((op) => tx.objectStore(OUTBOX).add({ ...op, queued_at: Date.now() }));
  });
  pendingHook();
}

let pendingHook: () => void = () => {};
/** lib/sync.ts registers here to send queued changes soon after they're made. */
export function onQueued(fn: () => void) {
  pendingHook = fn;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(META).objectStore(META).get(key)) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown) {
  await withTransaction([META], async (tx) => {
    tx.objectStore(META).put(value, key);
  });
}
