import { SHOW_MONEY } from '../ui/stock';
import React, { useMemo, useState } from 'react';
import {
  Search,
  PackagePlus,
  PencilLine,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  UserPlus,
  UserMinus,
  UserRound,
  Users,
  LockOpen,
  Lock,
  ShieldAlert,
  Send,
  FileDown,
  Download,
  Upload,
  Package,
  Warehouse, Bell, BellOff } from 'lucide-react';
import { ProductThumb } from '../ui/ProductThumb';
import { realReason, formatQty } from '../ui/stock';
import { MAIN_STORE_ID, Product, StockTransaction, Store } from '../../types/inventory';
import { ActivityAction, ActivityEntry, FieldChange } from '../../lib/activity';
import { DailySummaries } from './DailySummaries';

interface StockHistoryViewProps {
  transactions: StockTransaction[];
  activity: ActivityEntry[];
  products: Product[];
  stores: Store[];
  scopeLabel: string;
  /** Every movement (not only this store's), to find the other half of a transfer */
  allTransactions: StockTransaction[];
}

type Section = 'all' | 'stock' | 'product' | 'people' | 'data' | 'summary';
type Period = 'all' | 'today' | '7d' | '30d';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stock' },
  { id: 'product', label: 'Products' },
  { id: 'people', label: 'People and access' },
  { id: 'data', label: 'Stores and backup' },
  { id: 'summary', label: 'Daily summaries' }
];

const SECTION_HINT: Record<Section, string> = {
  all: 'Everything that happened, newest first',
  stock: 'Stock in, stock out and count corrections',
  product: 'Products added, edited, removed or imported',
  people: 'Staff list changes, who used the phone, and admin mode',
  data: 'Stores, backups, imports and exports',
  summary: 'Saved every day at 8 PM: stock in and out for each store where stock moved'
};

const ACTION_ICON: Record<ActivityAction, typeof Package> = {
  'product.created': PackagePlus,
  'product.updated': PencilLine,
  'product.removed': Trash2,
  'product.restored': RotateCcw,
  'product.imported': FileSpreadsheet,
  'people.added': UserPlus,
  'people.removed': UserMinus,
  'people.list_received': Users,
  'people.switched': UserRound,
  'people.admin_on': LockOpen,
  'people.admin_off': Lock,
  'people.admin_failed': ShieldAlert,
  'data.sent': Send,
  'data.received': FileDown,
  'data.backup': Download,
  'data.restored': Upload,
  'data.exported': FileSpreadsheet,
  'data.store_added': Warehouse,
  'data.store_renamed': Warehouse,
  'data.store_removed': Warehouse,
  'data.alerts_on': Bell,
  'data.alerts_off': BellOff
};

/** One row in the list, whether it came from a stock movement or the activity log. */
interface Row {
  id: string;
  at: string;
  user: string;
  role?: 'admin' | 'staff';
  section: Exclude<Section, 'all'>;
  searchText: string;
  tx?: StockTransaction;
  entry?: ActivityEntry;
}

const PAGE = 60;

export const StockHistoryView: React.FC<StockHistoryViewProps> = ({ transactions, activity, products, stores, scopeLabel, allTransactions }) => {
  const multiStore = stores.filter((st) => st.is_active).length > 1;
  const storeName = (id?: string) => stores.find((st) => st.id === (id || MAIN_STORE_ID))?.name || 'Main Store';
  const [section, setSection] = useState<Section>('all');
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('ALL');
  const [period, setPeriod] = useState<Period>('all');
  const [stockType, setStockType] = useState<'ALL' | 'IN' | 'OUT' | 'ADJUSTMENT'>('ALL');
  const [limit, setLimit] = useState(PAGE);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const rows: Row[] = useMemo(() => {
    // A transfer is two movements; when both are listed, show it once (from the stock-out half)
    const listed = new Set(transactions.map((t) => t.id));
    const stockRows: Row[] = transactions
      .filter((t) => !(t.transfer_id && t.type === 'IN' && transactions.some((o) => o.transfer_id === t.transfer_id && o.id !== t.id && listed.has(o.id))))
      .map((t) => {
      const p = productById.get(t.product_id);
      return {
        id: `tx-${t.id}`,
        at: t.created_at,
        user: t.user_name || 'Staff',
        section: 'stock',
        searchText: [p?.name, t.product_name, p?.brand, p?.sku, t.user_name, t.reason, t.reference, storeName(t.store_id), t.transfer_id ? 'transfer' : ''].join(' ').toLowerCase(),
        tx: t
      };
    });
    const activityRows: Row[] = activity.map((e) => ({
      id: `act-${e.id}`,
      at: e.created_at,
      user: e.user,
      role: e.role,
      section: e.category,
      searchText: [e.summary, e.user, e.product_name, ...(e.details || []), ...visibleChanges(e.changes).map((c) => `${c.field} ${c.from} ${c.to}`)]
        .join(' ')
        .toLowerCase(),
      entry: e
    }));
    return [...stockRows, ...activityRows].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [transactions, activity, productById, stores]);

  const transferInfo = (t: StockTransaction): TransferInfo | undefined => {
    if (!t.transfer_id) return undefined;
    const other = allTransactions.find((o) => o.transfer_id === t.transfer_id && o.id !== t.id);
    const outLeg = t.type === 'OUT' ? t : other;
    const inLeg = t.type === 'IN' ? t : other;
    const both = !!other && transactions.some((o) => o.id === other.id);
    return {
      both,
      from: outLeg ? storeName(outLeg.store_id) : 'another store',
      to: inLeg ? storeName(inLeg.store_id) : 'another store',
      toBefore: inLeg?.previous_stock,
      toAfter: inLeg?.new_stock
    };
  };

  const people = useMemo(() => Array.from(new Set(rows.map((r) => r.user))).sort((a, b) => a.localeCompare(b)), [rows]);

  // Filters other than the section, so the section counts reflect them
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const since =
      period === 'today'
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : period === '7d'
        ? Date.now() - 7 * 864e5
        : period === '30d'
        ? Date.now() - 30 * 864e5
        : 0;
    return rows.filter((r) => {
      if (person !== 'ALL' && r.user !== person) return false;
      if (since && new Date(r.at).getTime() < since) return false;
      if (q && !r.searchText.includes(q)) return false;
      return true;
    });
  }, [rows, query, person, period]);

  const counts = useMemo(() => {
    const c: Record<Section, number> = { all: filtered.length, stock: 0, product: 0, people: 0, data: 0, summary: 0 };
    filtered.forEach((r) => c[r.section]++);
    return c;
  }, [filtered]);

  const visible = useMemo(
    () =>
      filtered.filter(
        (r) => (section === 'all' || r.section === section) && (section !== 'stock' || stockType === 'ALL' || r.tx?.type === stockType)
      ),
    [filtered, section, stockType]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    visible.slice(0, limit).forEach((r) => {
      const key = new Date(r.at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [visible, limit]);

  const control = 'h-10 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-slate-600';
  const filtersOn = query || person !== 'ALL' || period !== 'all' || (section === 'stock' && stockType !== 'ALL');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] leading-tight font-medium text-slate-100">History</h1>
        <p className="mt-1 text-sm text-slate-500">Who did what, and when · stock movements for {scopeLabel}</p>
      </div>

      {/* Sections */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-none">
        <div role="tablist" className="inline-flex gap-1 p-1 rounded-xl border border-slate-800 bg-slate-950">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              onClick={() => {
                setSection(s.id);
                setLimit(PAGE);
              }}
              className={`h-9 px-3 rounded-lg text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                section === s.id ? 'bg-slate-850 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {s.label}
              {s.id !== 'summary' && <span className={`text-xs ${section === s.id ? 'text-slate-400' : 'text-slate-600'}`}>{counts[s.id]}</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="-mt-2 text-sm text-slate-500">{SECTION_HINT[section]}</p>

      {section === 'summary' ? <DailySummaries /> : (<>
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label className="relative block col-span-2">
          <span className="sr-only">Search</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
          <input
            type="search"
            placeholder="Product, person or detail"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${control} w-full pl-9 pr-3 placeholder-slate-500 text-base sm:text-sm`}
          />
        </label>
        <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person" className={`${control} px-3`}>
          <option value="ALL">Everyone</option>
          {people.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="When" className={`${control} px-3`}>
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        {section === 'stock' && (
          <select value={stockType} onChange={(e) => setStockType(e.target.value as typeof stockType)} aria-label="Type" className={`${control} px-3 col-span-2 md:col-span-1`}>
            <option value="ALL">In, out and corrections</option>
            <option value="IN">Stock in</option>
            <option value="OUT">Stock out</option>
            <option value="ADJUSTMENT">Count corrections</option>
          </select>
        )}
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
          <p className="text-base text-slate-200">{filtersOn ? 'Nothing matches these filters' : 'Nothing here yet'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {filtersOn ? 'Try another word, person or time' : 'Changes are recorded here automatically as people use the app'}
          </p>
        </div>
      ) : (
        <>
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-slate-300">{dayLabel(key)}</span>
                <span className="text-slate-500">{items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
              </h2>
              <ul className="rounded-2xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
                {items.map((r) => (
                  <li key={r.id}>{r.tx ? <StockRow
                        tx={r.tx}
                        product={productById.get(r.tx.product_id)}
                        storeLabel={multiStore && scopeLabel === 'All stores' ? storeName(r.tx.store_id) : undefined}
                        transfer={transferInfo(r.tx)}
                      /> : <ActivityRow entry={r.entry!} product={r.entry?.product_id ? productById.get(r.entry.product_id) : undefined} />}</li>
                ))}
              </ul>
            </section>
          ))}
          {visible.length > limit && (
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full h-11 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-sm text-slate-300 transition-colors"
            >
              Show more ({visible.length - limit} older)
            </button>
          )}
        </>
      )}
      </>)}
    </div>
  );
};

// ---------- Rows ----------

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function dayLabel(key: string) {
  const d = new Date(key);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const Who: React.FC<{ user: string; role?: 'admin' | 'staff' }> = ({ user, role }) => (
  <span className="text-slate-300">
    {user}
    {role === 'admin' && <span className="ml-1.5 text-xs text-amber-400">admin</span>}
  </span>
);

interface TransferInfo {
  /** Both halves listed: one line "Transfer · A → B" */
  both: boolean;
  from: string;
  to: string;
  toBefore?: number;
  toAfter?: number;
}

const StockRow: React.FC<{ tx: StockTransaction; product?: Product; storeLabel?: string; transfer?: TransferInfo }> = ({
  tx,
  product,
  storeLabel,
  transfer
}) => {
  const isIn = tx.type === 'IN';
  const isOut = tx.type === 'OUT';
  let sign = isIn ? '+' : isOut ? '−' : '';
  let tone = isIn ? 'text-emerald-400' : isOut ? 'text-rose-400' : 'text-slate-100';
  let kind = isIn ? 'Stock in' : isOut ? 'Stock out' : 'Count corrected';
  if (transfer) {
    tone = 'text-slate-100';
    if (transfer.both) {
      sign = '';
      kind = `Transfer · ${transfer.from} → ${transfer.to}`;
      storeLabel = undefined;
    } else {
      kind = isOut ? `Transfer to ${transfer.to}` : `Transfer from ${transfer.from}`;
    }
  }
  const name = product?.name || tx.product_name || 'Product';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ProductThumb src={product?.image_url || tx.product_image} alt={name} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-slate-100 truncate">{name}</p>
        <p className={`mt-0.5 text-sm text-slate-500 ${transfer?.both ? '' : 'truncate'}`}>
          {kind}{storeLabel ? ` · ${storeLabel}` : ''} · <Who user={tx.user_name || 'Staff'} />
          {realReason(tx.reason) ? ` · ${tx.reason}` : ''}
          {tx.reference ? ` · Ref ${tx.reference}` : ''}
        </p>
        {transfer?.both && (
          <p className="mt-0.5 text-xs text-slate-500">
            {transfer.from} {formatQty(tx.previous_stock)} → {formatQty(tx.new_stock)}
            {transfer.toBefore !== undefined ? ` · ${transfer.to} ${formatQty(transfer.toBefore)} → ${formatQty(transfer.toAfter!)}` : ''}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[15px] font-semibold ${tone}`}>
          {sign}{formatQty(tx.quantity)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {transfer?.both ? '' : `${formatQty(tx.previous_stock)} → ${formatQty(tx.new_stock)} · `}
          {time(tx.created_at)}
        </p>
      </div>
    </div>
  );
};

const ActivityRow: React.FC<{ entry: ActivityEntry; product?: Product }> = ({ entry, product }) => {
  const Icon = ACTION_ICON[entry.action] || Package;
  const warn = entry.action === 'people.admin_failed' || entry.action === 'product.removed';
  return (
    <div className="flex gap-3 px-4 py-3">
      {product ? (
        <ProductThumb src={product.image_url} alt={product.name} size={40} />
      ) : (
        <div className="w-10 h-10 shrink-0 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center">
          <Icon className={`w-[18px] h-[18px] ${warn ? 'text-rose-400' : 'text-slate-500'}`} strokeWidth={1.5} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-[15px] ${warn ? 'text-rose-300' : 'text-slate-100'}`}>{entry.summary}</p>
          <span className="shrink-0 text-xs text-slate-500">{time(entry.created_at)}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          <Who user={entry.user} role={entry.role} />
        </p>
        {visibleChanges(entry.changes).length > 0 && <Changes changes={visibleChanges(entry.changes)} />}
        {entry.details && entry.details.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm text-slate-400">
            {entry.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Price lines stay hidden while money is hidden
const visibleChanges = (c?: FieldChange[]) => (c || []).filter((x) => SHOW_MONEY || !['Cost price', 'Selling price'].includes(x.field));

const Changes: React.FC<{ changes: FieldChange[] }> = ({ changes }) => (
  <dl className="mt-2 rounded-lg border border-slate-800 bg-slate-950 divide-y divide-slate-800 text-sm">
    {changes.map((c, i) => (
      <div key={i} className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3 px-3 py-1.5">
        <dt className="text-slate-500 truncate">{c.field}</dt>
        <dd className="min-w-0 text-slate-300 break-words">
          {c.from ? (
            <>
              <span className="text-slate-500 line-through decoration-slate-600">{c.from}</span>
              <span className="mx-1.5 text-slate-600">→</span>
            </>
          ) : null}
          <span className="text-slate-100">{c.to}</span>
        </dd>
      </div>
    ))}
  </dl>
);
