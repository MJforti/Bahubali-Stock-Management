/**
 * Snapshot of everything on this phone, used for the first upload to the
 * central database (lib/sync.ts). It pins each product's opening stock from
 * its movement history, so the central database replays stock the same way.
 */
import { Product, StockTransaction } from '../types/inventory';
import { PRODUCTS, TRANSACTIONS, withTransaction } from './localDb';
import { RosterEntry, getRoster } from './staffNames';
import { ActivityEntry, fetchActivity } from './activity';

export interface SyncFile {
  app: 'bahubali-stock-management';
  kind: 'sync';
  version: 1;
  from: string | null;
  exported_at: string;
  products: Product[];
  stock_transactions: StockTransaction[];
  staff_roster: RosterEntry[];
  activity?: ActivityEntry[];
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
  const activity = await fetchActivity();
  const file = await withTransaction([PRODUCTS, TRANSACTIONS], async (tx) => {
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
      staff_roster: getRoster(),
      activity
    } as SyncFile;
  });
  return file;
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
