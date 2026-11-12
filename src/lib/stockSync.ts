/**
 * Sharing stock data between phones, offline.
 *
 * One phone saves a sync file (products, stock movements and the staff
 * list) and sends it any way it likes: WhatsApp, Bluetooth, Nearby Share.
 * The other phone opens it and the two are merged, never overwritten:
 *
 *  - Stock movements are a log with unique ids, so merging is a union.
 *    Movements made on both phones are all kept.
 *  - Stock levels are then recalculated for every product by replaying its
 *    movements in time order from its opening stock. Two phones that each
 *    sold units end up with both sales subtracted. A count correction
 *    sets the stock to the counted number at that moment.
 *  - Product details (name, price, rack, photo, active) follow the most
 *    recent edit, by `details_updated_at`.
 *  - The staff list merges like the name-list QR code (newest change wins).
 */
import { Product, StockTransaction } from '../types/inventory';
import { PRODUCTS, TRANSACTIONS, withTransaction, notifyOtherTabs } from './localDb';
import { RosterEntry, getRoster, mergeRoster } from './staffNames';

export interface SyncFile {
  app: 'bahubali-stock-management';
  kind: 'sync';
  version: 1;
  from: string | null;
  exported_at: string;
  products: Product[];
  stock_transactions: StockTransaction[];
  staff_roster: RosterEntry[];
}

export interface SyncResult {
  newProducts: number;
  updatedProducts: number;
  newMovements: number;
  stockChanged: number;
  negative: string[];
  namesAdded: string[];
  namesRemoved: string[];
}

const time = (iso?: string) => (iso ? new Date(iso).getTime() || 0 : 0);

const byTime = (a: StockTransaction, b: StockTransaction) =>
  time(a.created_at) - time(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Applies one movement to a running stock figure. */
function apply(running: number, t: StockTransaction) {
  if (t.type === 'IN') return running + Number(t.quantity || 0);
  if (t.type === 'OUT') return running - Number(t.quantity || 0);
  return Number(t.new_stock || 0); // count correction sets the stock outright
}

/**
 * Opening stock for a product that predates this feature: the stock before
 * its first movement, nudged so that replaying this phone's own log gives
 * exactly today's stock (nothing changes until something new is merged in).
 */
function deriveOpening(p: Product, txs: StockTransaction[]): number {
  if (typeof p.opening_stock === 'number' && isFinite(p.opening_stock)) return p.opening_stock;
  if (txs.length === 0) return Number(p.current_stock) || 0;
  const sorted = [...txs].sort(byTime);
  let opening = Number(sorted[0].previous_stock) || 0;
  const lastCorrection = sorted.map((t) => t.type).lastIndexOf('ADJUSTMENT');
  if (lastCorrection === -1) {
    const replayed = sorted.reduce(apply, opening);
    opening += (Number(p.current_stock) || 0) - replayed;
  }
  return opening;
}

/** Everything this phone knows, ready to send. */
export async function buildSyncFile(from: string | null): Promise<SyncFile> {
  return withTransaction([PRODUCTS, TRANSACTIONS], async (tx) => {
    const products = (await reqAll<Product>(tx.objectStore(PRODUCTS))) as Product[];
    const txs = (await reqAll<StockTransaction>(tx.objectStore(TRANSACTIONS))) as StockTransaction[];
    const byProduct = groupBy(txs);
    // Pin opening stock now so both phones agree on it from here on
    const pinned = products.map((p) => {
      if (typeof p.opening_stock === 'number') return p;
      const withOpening = { ...p, opening_stock: deriveOpening(p, byProduct.get(p.id) || []) };
      tx.objectStore(PRODUCTS).put(withOpening);
      return withOpening;
    });
    return {
      app: 'bahubali-stock-management',
      kind: 'sync',
      version: 1,
      from,
      exported_at: new Date().toISOString(),
      products: pinned,
      stock_transactions: txs.map(stripDisplayFields),
      staff_roster: getRoster()
    } as SyncFile;
  });
}

export function isSyncFile(x: any): x is SyncFile {
  return (
    x &&
    x.app === 'bahubali-stock-management' &&
    x.kind === 'sync' &&
    Array.isArray(x.products) &&
    Array.isArray(x.stock_transactions)
  );
}

/** Merges another phone's sync file into this phone. */
export async function mergeSyncFile(file: SyncFile): Promise<SyncResult> {
  if (!isSyncFile(file)) throw new Error('This is not a stock file from the Bahubali app.');

  const result: SyncResult = {
    newProducts: 0,
    updatedProducts: 0,
    newMovements: 0,
    stockChanged: 0,
    negative: [],
    namesAdded: [],
    namesRemoved: []
  };

  await withTransaction([PRODUCTS, TRANSACTIONS], async (tx) => {
    const localProducts = (await reqAll<Product>(tx.objectStore(PRODUCTS))) as Product[];
    const localTxs = (await reqAll<StockTransaction>(tx.objectStore(TRANSACTIONS))) as StockTransaction[];
    const localByProduct = groupBy(localTxs);
    const localIds = new Set(localTxs.map((t) => t.id));

    // 1. Product details: newest edit wins; opening stock pinned from whichever side has it
    const products = new Map<string, Product>();
    const before = new Map<string, number>();
    for (const p of localProducts) {
      before.set(p.id, Number(p.current_stock) || 0);
      products.set(p.id, { ...p, opening_stock: deriveOpening(p, localByProduct.get(p.id) || []) });
    }
    for (const incoming of file.products) {
      if (!incoming || typeof incoming.id !== 'string') continue;
      const mine = products.get(incoming.id);
      if (!mine) {
        products.set(incoming.id, {
          ...incoming,
          opening_stock: typeof incoming.opening_stock === 'number' ? incoming.opening_stock : Number(incoming.current_stock) || 0
        });
        result.newProducts++;
        continue;
      }
      if (time(incoming.details_updated_at) > time(mine.details_updated_at)) {
        const { current_stock: _s, opening_stock: _o, ...details } = incoming;
        products.set(incoming.id, { ...mine, ...details });
        result.updatedProducts++;
      }
    }

    // 2. Movements: union by id
    const txs = new Map<string, StockTransaction>(localTxs.map((t) => [t.id, t]));
    for (const t of file.stock_transactions) {
      if (!t || typeof t.id !== 'string' || txs.has(t.id)) continue;
      txs.set(t.id, stripDisplayFields(t));
      result.newMovements++;
    }

    // 3. Replay each product's movements from its opening stock
    const merged = groupBy(Array.from(txs.values()));
    for (const [id, p] of products) {
      let running = Number(p.opening_stock) || 0;
      const list = (merged.get(id) || []).sort(byTime);
      for (const t of list) {
        const prev = running;
        running = apply(running, t);
        const fixed: StockTransaction = {
          ...t,
          previous_stock: prev,
          new_stock: running,
          quantity: t.type === 'ADJUSTMENT' ? Math.abs(running - prev) : Number(t.quantity) || 0
        };
        if (fixed.previous_stock !== t.previous_stock || fixed.new_stock !== t.new_stock || fixed.quantity !== t.quantity || !localIds.has(t.id)) {
          tx.objectStore(TRANSACTIONS).put(fixed);
        }
      }
      const updated: Product = { ...p, current_stock: running };
      if (before.has(id) && before.get(id) !== running) result.stockChanged++;
      if (running < 0) result.negative.push(p.name);
      tx.objectStore(PRODUCTS).put(updated);
    }
  });

  if (Array.isArray(file.staff_roster)) {
    const names = mergeRoster(file.staff_roster);
    result.namesAdded = names.added;
    result.namesRemoved = names.removed;
  }

  notifyOtherTabs({ kind: 'reload' });
  return result;
}

export function describeSync(r: SyncResult): string[] {
  const lines: string[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  if (r.newMovements) lines.push(`${n(r.newMovements, 'new movement', 'new movements')} added to history`);
  if (r.stockChanged) lines.push(`Stock updated for ${n(r.stockChanged, 'product', 'products')}`);
  if (r.newProducts) lines.push(`${n(r.newProducts, 'new product', 'new products')}`);
  if (r.updatedProducts) lines.push(`Details updated for ${n(r.updatedProducts, 'product', 'products')}`);
  if (r.namesAdded.length) lines.push(`Added ${r.namesAdded.join(', ')} to the staff list`);
  if (r.namesRemoved.length) lines.push(`Removed ${r.namesRemoved.join(', ')} from the staff list`);
  if (!lines.length) lines.push('This phone was already up to date');
  return lines;
}

// ---------- helpers ----------

function reqAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror = () => reject(r.error);
  });
}

function groupBy(txs: StockTransaction[]) {
  const map = new Map<string, StockTransaction[]>();
  for (const t of txs) {
    if (!map.has(t.product_id)) map.set(t.product_id, []);
    map.get(t.product_id)!.push(t);
  }
  return map;
}

/** Product name/photo on a movement are filled in for display; don't store copies of photos twice. */
function stripDisplayFields(t: StockTransaction): StockTransaction {
  const { product_image: _i, ...rest } = t;
  return rest as StockTransaction;
}
