/**
 * Sync between this phone and the central Supabase database.
 *
 * - The app reads and writes the local database only (works offline).
 * - Every local change is queued in the outbox (lib/localDb.ts).
 * - push(): sends queued changes through the database's sync_* functions,
 *   which merge safely (movements are kept from every phone, stock is
 *   recalculated in time order, the newest product edit wins).
 * - pull(): fetches rows changed since the last pull (by sync_seq) and
 *   stores them locally. Live updates from Supabase trigger a pull.
 */
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Product, StockTransaction } from '../types/inventory';
import {
  ACTIVITY,
  OUTBOX,
  OutboxOp,
  PRODUCTS,
  TRANSACTIONS,
  getMeta,
  notifyOtherTabs,
  onQueued,
  openDb,
  queue,
  setMeta,
  withTransaction
} from './localDb';
import { ActivityEntry } from './activity';
import { RosterEntry, getRoster, mergeRoster } from './staffNames';
import { buildSyncFile } from './stockSync';

// Public project URL and publishable key: safe to ship in the app. The
// database only lets this key read, and write through the sync_* functions.
export const SUPABASE_URL = 'https://bpbhnnnrjckcqjvgogsu.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_XIftpJPy3WCXwLDXd81m2A_CeTjKrYE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ---------- Status for the UI ----------

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  live: boolean;
  lastSyncedAt: number | null;
  error: string | null;
}

let status: SyncStatus = { state: 'idle', pending: 0, live: false, lastSyncedAt: null, error: null };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn(status));
}

export function onSyncStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

/** Called after pulled data was stored, so the app can reload what it shows. */
let onDataChanged: () => void = () => {};

// ---------- Mapping local <-> central ----------

const iso = (v?: string) => (v && !isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : undefined);

function productToCloud(p: Product) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    sub_category: p.sub_category,
    sku: p.sku,
    description: p.description,
    unit: p.unit,
    opening_stock: p.opening_stock ?? p.current_stock,
    minimum_stock: p.minimum_stock,
    reorder_level: p.reorder_level,
    maximum_stock: p.maximum_stock ?? null,
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    supplier: p.supplier,
    rack: p.rack,
    shelf: p.shelf,
    store_section: p.store_section,
    photo_url: p.image_url && !p.image_url.startsWith('data:') ? p.image_url : '',
    is_active: p.is_active !== false,
    created_at: iso(p.created_at),
    details_updated_at: iso(p.details_updated_at) ?? '1970-01-01T00:00:00.000Z',
    created_by: p.created_by,
    updated_by: p.updated_by
  };
}

function productFromCloud(r: any, local?: Product): Product {
  const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));
  return {
    ...(local || {}),
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    sub_category: r.sub_category,
    sku: r.sku,
    description: r.description,
    unit: r.unit,
    current_stock: num(r.current_stock),
    opening_stock: num(r.opening_stock),
    minimum_stock: num(r.minimum_stock),
    reorder_level: num(r.reorder_level),
    maximum_stock: r.maximum_stock === null ? undefined : num(r.maximum_stock),
    purchase_price: num(r.purchase_price),
    selling_price: num(r.selling_price),
    supplier: r.supplier,
    rack: r.rack,
    shelf: r.shelf,
    store_section: r.store_section,
    // Keep a local photo that is still waiting to upload
    image_url: r.photo_url || (local?.image_url?.startsWith('data:') ? local.image_url : ''),
    is_active: r.is_active,
    created_at: r.created_at,
    updated_at: r.stock_updated_at && r.stock_updated_at > r.details_updated_at ? r.stock_updated_at : r.details_updated_at,
    details_updated_at: r.details_updated_at,
    created_by: r.created_by,
    updated_by: r.updated_by
  } as Product;
}

const movementToCloud = (t: StockTransaction) => ({
  id: t.id,
  product_id: t.product_id,
  product_name: t.product_name || '',
  movement: t.type,
  quantity: Number(t.quantity) || 0,
  stock_before: Number(t.previous_stock) || 0,
  stock_after: Number(t.new_stock) || 0,
  reason: t.reason || '',
  reference: t.reference || '',
  done_by: t.user_name || '',
  done_at: iso(t.created_at) ?? new Date().toISOString()
});

const movementFromCloud = (r: any): StockTransaction => ({
  id: r.id,
  product_id: r.product_id,
  product_name: r.product_name,
  type: r.movement,
  quantity: Number(r.quantity),
  previous_stock: Number(r.stock_before),
  new_stock: Number(r.stock_after),
  reason: r.reason,
  reference: r.reference,
  user_name: r.done_by,
  created_at: r.done_at
});

const activityToCloud = (a: ActivityEntry) => ({
  id: a.id,
  happened_at: iso(a.created_at),
  done_by: a.user,
  role: a.role,
  section: a.category,
  action: a.action,
  summary: a.summary,
  product_id: a.product_id ?? null,
  product_name: a.product_name ?? null,
  changes: a.changes ?? null,
  details: a.details ?? null
});

const activityFromCloud = (r: any): ActivityEntry => ({
  id: r.id,
  created_at: r.happened_at,
  user: r.done_by,
  role: r.role,
  category: r.section,
  action: r.action,
  summary: r.summary,
  product_id: r.product_id ?? undefined,
  product_name: r.product_name ?? undefined,
  changes: r.changes ?? undefined,
  details: r.details ?? undefined
});

const staffToCloud = (e: RosterEntry) => ({ name: e.n, is_active: !e.r, changed_at: new Date(e.t).toISOString() });
const staffFromCloud = (r: any): RosterEntry =>
  r.is_active ? { n: r.name, t: new Date(r.changed_at).getTime() } : { n: r.name, t: new Date(r.changed_at).getTime(), r: 1 };

// ---------- Helpers ----------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idbAll<T>(store: IDBObjectStore | IDBIndex, query?: IDBValidKey | IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const r = store.getAll(query);
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror = () => reject(r.error);
  });
}

async function readOutbox(): Promise<(OutboxOp & { seq: number })[]> {
  const db = await openDb();
  return idbAll(db.transaction(OUTBOX).objectStore(OUTBOX));
}

async function countPending() {
  const ops = await readOutbox();
  setStatus({ pending: ops.length });
  return ops.length;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/jpeg';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Upload a photo taken offline and swap the local copy for the stored URL. */
async function uploadPhoto(p: Product): Promise<string> {
  const blob = dataUrlToBlob(p.image_url!);
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `products/${p.id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('product-photos').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  const url = supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl;
  await withTransaction([PRODUCTS], async (tx, get) => {
    const cur = await get<Product>(PRODUCTS, p.id);
    if (cur && cur.image_url === p.image_url) tx.objectStore(PRODUCTS).put({ ...cur, image_url: url });
  });
  return url;
}

async function rpc(fn: string, items: unknown[]) {
  for (let i = 0; i < items.length; i += 400) {
    const { error } = await supabase.rpc(fn, { items: items.slice(i, i + 400) });
    if (error) throw new Error(error.message);
  }
}

// ---------- Push ----------

async function push() {
  const ops = await readOutbox();
  if (!ops.length) return;

  const db = await openDb();
  const get = <T,>(store: string, key: string) =>
    new Promise<T | undefined>((res, rej) => {
      const r = db.transaction(store).objectStore(store).get(key);
      r.onsuccess = () => res(r.result as T);
      r.onerror = () => rej(r.error);
    });

  const productIds = new Set<string>();
  const movementIds = new Set<string>();
  const activityIds = new Set<string>();
  const staffNames = new Set<string>();
  for (const op of ops) {
    // An id the central database can't accept would block the queue forever: skip it
    if (op.kind !== 'staff' && !UUID.test(op.id)) continue;
    if (op.kind === 'product') productIds.add(op.id);
    else if (op.kind === 'movement') movementIds.add(op.id);
    else if (op.kind === 'activity') activityIds.add(op.id);
    else staffNames.add(op.name.toLowerCase());
  }

  const products = (await Promise.all([...productIds].map((id) => get<Product>(PRODUCTS, id)))).filter(Boolean) as Product[];
  const movements = (await Promise.all([...movementIds].map((id) => get<StockTransaction>(TRANSACTIONS, id)))).filter(Boolean) as StockTransaction[];
  const activity = (await Promise.all([...activityIds].map((id) => get<ActivityEntry>(ACTIVITY, id)))).filter(Boolean) as ActivityEntry[];
  const staff = getRoster().filter((e) => staffNames.has(e.n.toLowerCase()));


  const productRows = [];
  for (const p of products) {
    let photo = p.image_url;
    if (photo?.startsWith('data:')) photo = await uploadPhoto(p);
    productRows.push(productToCloud({ ...p, image_url: photo }));
  }

  if (productRows.length) await rpc('sync_products', productRows);
  if (movements.length) await rpc('sync_movements', movements.map(movementToCloud));
  if (activity.length) await rpc('sync_activity', activity.map(activityToCloud));
  if (staff.length) await rpc('sync_staff', staff.map(staffToCloud));

  // Sent: remove exactly the ops we read (new ones queued meanwhile stay)
  const maxSeq = Math.max(...ops.map((o) => o.seq));
  await withTransaction([OUTBOX], async (tx) => {
    tx.objectStore(OUTBOX).delete(IDBKeyRange.upperBound(maxSeq));
  });
}

// ---------- Pull ----------

const TABLES = ['products', 'stock_movements', 'activity_log', 'staff'] as const;

async function pull(): Promise<boolean> {
  let changed = false;
  for (const table of TABLES) {
    const cursorKey = `cursor_${table}`;
    let cursor = (await getMeta<number>(cursorKey)) ?? 0;
    for (;;) {
      const { data, error } = await supabase.from(table).select('*').gt('sync_seq', cursor).order('sync_seq').limit(1000);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      await applyRows(table, data);
      cursor = Number(data[data.length - 1].sync_seq);
      await setMeta(cursorKey, cursor);
      changed = true;
      if (data.length < 1000) break;
    }
  }
  return changed;
}

async function applyRows(table: (typeof TABLES)[number], rows: any[]) {
  if (table === 'staff') {
    mergeRoster(rows.map(staffFromCloud), false);
    return;
  }
  await withTransaction([PRODUCTS, TRANSACTIONS, ACTIVITY, OUTBOX], async (tx, get) => {
    // Don't overwrite products with changes still waiting to be sent
    const pendingOps = await idbAll<OutboxOp>(tx.objectStore(OUTBOX));
    const busy = new Set<string>();
    for (const op of pendingOps) {
      if (op.kind === 'product') busy.add(op.id);
      if (op.kind === 'movement') {
        const t = await get<StockTransaction>(TRANSACTIONS, op.id);
        if (t) busy.add(t.product_id);
      }
    }
    for (const r of rows) {
      if (table === 'products') {
        if (busy.has(r.id)) continue;
        const local = await get<Product>(PRODUCTS, r.id);
        tx.objectStore(PRODUCTS).put(productFromCloud(r, local));
      } else if (table === 'stock_movements') {
        tx.objectStore(TRANSACTIONS).put(movementFromCloud(r));
      } else {
        tx.objectStore(ACTIVITY).put(activityFromCloud(r));
      }
    }
  });
}

// ---------- First connection: send everything this phone already has ----------

async function firstUpload() {
  if (await getMeta<boolean>('cloud_uploaded')) return;
  const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  const serverEmpty = !count;

  // buildSyncFile pins each product's opening stock from its history
  const file = await buildSyncFile(null);
  const ops: OutboxOp[] = [];
  for (const p of file.products) {
    // Untouched demo products only seed an empty database
    const touched = !!p.details_updated_at || file.stock_transactions.some((t) => t.product_id === p.id);
    if (serverEmpty || touched) ops.push({ kind: 'product', id: p.id });
  }
  file.stock_transactions.forEach((t) => ops.push({ kind: 'movement', id: t.id }));
  (file.activity || []).forEach((a) => ops.push({ kind: 'activity', id: a.id }));
  file.staff_roster.forEach((e) => ops.push({ kind: 'staff', name: e.n }));
  await queue(ops);
  await setMeta('cloud_uploaded', true);
}

/** After restoring a backup: send its contents (merged with the central data, never wiping it). */
export async function resendEverything() {
  await setMeta('cloud_uploaded', false);
  // Also fetch everything again, so data only the central database has comes back too
  for (const table of TABLES) await setMeta(`cursor_${table}`, 0);
  scheduleSync(0);
}

// ---------- Running it ----------

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSync(delay = 400) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow().catch(() => {});
  }, delay);
}

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          await countPending();
          setStatus({ state: 'offline' });
          return;
        }
        setStatus({ state: 'syncing', error: null });
        await firstUpload();
        await push();
        const changed = (await countPending()) === 0 ? await pull() : false;
        if (changed) {
          onDataChanged();
          notifyOtherTabs({ kind: 'reload' });
        }
        setStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null });
      } while (again);
    } catch (err: any) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const message = String(err?.message || err);
      setStatus({
        state: offline || /fetch|network|Failed to fetch|Load failed/i.test(message) ? 'offline' : 'error',
        error: message
      });
      await countPending().catch(() => {});
    } finally {
      running = null;
    }
  })();
  return running;
}

let channel: RealtimeChannel | null = null;

/** Start syncing: now, after every local change, on live updates, when back online, and every minute. */
export function startSync(dataChanged: () => void) {
  onDataChanged = dataChanged;
  onQueued(() => {
    countPending().catch(() => {});
    scheduleSync();
  });

  channel = supabase.channel('bahubali-db');
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleSync(150));
  }
  channel.subscribe((s) => {
    setStatus({ live: s === 'SUBSCRIBED' });
    if (s === 'SUBSCRIBED') scheduleSync(0);
  });

  const wake = () => scheduleSync(0);
  window.addEventListener('online', wake);
  window.addEventListener('offline', () => setStatus({ state: 'offline', live: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake();
  });
  const interval = setInterval(wake, 60_000);

  scheduleSync(0);
  return () => {
    clearInterval(interval);
    window.removeEventListener('online', wake);
    if (channel) supabase.removeChannel(channel);
  };
}

