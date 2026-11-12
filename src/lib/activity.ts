/**
 * Activity log: who did what, besides stock movements (which have their
 * own history). Kept on the phone and shared with other phones in the
 * stock file, merged by id so nothing is lost or doubled.
 */
import { ACTIVITY, OUTBOX, getAll, newId, notifyOtherTabs, queueInTx, withTransaction } from './localDb';
import { Product } from '../types/inventory';

export type ActivityCategory = 'product' | 'people' | 'data';

export type ActivityAction =
  | 'product.created'
  | 'product.updated'
  | 'product.removed'
  | 'product.restored'
  | 'product.imported'
  | 'people.added'
  | 'people.removed'
  | 'people.list_received'
  | 'people.switched'
  | 'people.admin_on'
  | 'people.admin_off'
  | 'people.admin_failed'
  | 'data.sent'
  | 'data.received'
  | 'data.backup'
  | 'data.restored'
  | 'data.exported';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ActivityEntry {
  id: string;
  created_at: string;
  user: string;
  role: 'admin' | 'staff';
  category: ActivityCategory;
  action: ActivityAction;
  /** One line, e.g. "Edited Bosch 8mm Drill Bit" */
  summary: string;
  product_id?: string;
  product_name?: string;
  changes?: FieldChange[];
  /** Extra lines, e.g. what a merge changed */
  details?: string[];
}

// Who is acting right now (set by the app when the person or admin mode changes)
let actor = { user: 'Staff', role: 'staff' as 'admin' | 'staff' };
export function setActor(user: string | null, role: 'admin' | 'staff') {
  actor = { user: user || (role === 'admin' ? 'Admin' : 'Staff'), role };
}
export const getActor = () => actor;

const categoryOf = (a: ActivityAction): ActivityCategory => a.split('.')[0] as ActivityCategory;

export async function logActivity(
  action: ActivityAction,
  summary: string,
  extra: Partial<Pick<ActivityEntry, 'product_id' | 'product_name' | 'changes' | 'details'>> = {}
): Promise<void> {
  const entry: ActivityEntry = {
    id: newId(),
    created_at: new Date().toISOString(),
    user: actor.user,
    role: actor.role,
    category: categoryOf(action),
    action,
    summary,
    ...extra
  };
  try {
    await withTransaction([ACTIVITY, OUTBOX], async (tx) => {
      tx.objectStore(ACTIVITY).put(entry);
      queueInTx(tx, { kind: 'activity', id: entry.id });
    });
    notifyOtherTabs({ kind: 'activity' });
    window.dispatchEvent(new CustomEvent('bahubali-activity'));
  } catch (err) {
    // Logging must never block the action itself
    console.warn('Could not record activity', err);
  }
}

export async function fetchActivity(): Promise<ActivityEntry[]> {
  const rows = await getAll<ActivityEntry>(ACTIVITY);
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/** Merge another phone's log (union by id). Returns how many entries were new. */
export async function mergeActivity(incoming: unknown): Promise<number> {
  if (!Array.isArray(incoming)) return 0;
  let added = 0;
  await withTransaction([ACTIVITY], async (tx, get) => {
    for (const e of incoming as ActivityEntry[]) {
      if (!e || typeof e.id !== 'string' || typeof e.summary !== 'string' || typeof e.created_at !== 'string') continue;
      if (await get(ACTIVITY, e.id)) continue;
      tx.objectStore(ACTIVITY).put(e);
      added++;
    }
  });
  if (added) notifyOtherTabs({ kind: 'activity' });
  return added;
}

// ---------- Describing product edits ----------

const FIELD_LABELS: Partial<Record<keyof Product, string>> = {
  name: 'Name',
  brand: 'Brand',
  category: 'Category',
  sub_category: 'Sub-category',
  sku: 'SKU',
  description: 'Description',
  unit: 'Unit',
  minimum_stock: 'Minimum stock',
  reorder_level: 'Reorder level',
  maximum_stock: 'Maximum stock',
  purchase_price: 'Cost price',
  selling_price: 'Selling price',
  supplier: 'Supplier',
  rack: 'Rack',
  shelf: 'Shelf',
  store_section: 'Section',
  image_url: 'Photo'
};

const PRICE_FIELDS = new Set(['purchase_price', 'selling_price']);

function show(field: string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (PRICE_FIELDS.has(field)) return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return String(v);
}

/** Field-by-field differences between two versions of a product (stock is logged separately). */
export function diffProduct(before: Product, after: Product): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, label] of Object.entries(FIELD_LABELS) as [keyof Product, string][]) {
    const a = before[field];
    const b = after[field];
    const same = PRICE_FIELDS.has(field as string) || typeof a === 'number' || typeof b === 'number'
      ? Number(a ?? 0) === Number(b ?? 0)
      : (a ?? '') === (b ?? '');
    if (same) continue;
    if (field === 'image_url') {
      changes.push({ field: label, from: a ? 'photo' : 'none', to: b ? 'new photo' : 'removed' });
    } else if (field === 'description') {
      changes.push({ field: label, from: '', to: 'updated' });
    } else {
      changes.push({ field: label, from: show(field, a), to: show(field, b) });
    }
  }
  return changes;
}
