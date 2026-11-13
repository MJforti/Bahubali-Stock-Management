import React, { useMemo, useState } from 'react';
import { Product, StockTransaction } from '../../types/inventory';
import { formatQty, stockState } from '../ui/stock';

/*
 * Overview charts. Colours (validated for the dark surface):
 *   stock in  #3987e5 (blue)   stock out #d95926 (orange)
 *   status: ok #0ca30c, low #fab219, out #d03b3b (always with a label)
 * Text never wears a series colour; marks carry the colour.
 */
const IN = '#3987e5';
const OUT = '#d95926';
const STATUS = { ok: '#0ca30c', low: '#fab219', out: '#d03b3b' };

const rs = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export interface StoreFigure {
  name: string;
  units: number;
  value: number;
}

interface Props {
  products: Product[];
  transactions: StockTransaction[];
  stores: StoreFigure[];
}

const Card: React.FC<{ title: string; note?: string; right?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, note, right, className = '', children }) => (
  <section className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${className}`}>
    <header className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-base font-medium text-slate-100">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-slate-500">{note}</p>}
      </div>
      {right}
    </header>
    {children}
  </section>
);

const Key: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="flex items-center gap-1.5 text-xs text-slate-400">
    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
    {label}
  </span>
);

/** Stock in and out per day, grouped columns, tap or hover for figures. */
const DailyFlow: React.FC<{ transactions: StockTransaction[] }> = ({ transactions }) => {
  const DAYS = 14;
  const days = useMemo(() => {
    const list: { key: string; date: Date; in: number; out: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      list.push({ key: dayKey(d), date: d, in: 0, out: 0 });
    }
    const byKey = new Map(list.map((d) => [d.key, d]));
    for (const t of transactions) {
      if (t.transfer_id || (t.type !== 'IN' && t.type !== 'OUT')) continue;
      const row = byKey.get(dayKey(new Date(t.created_at)));
      if (!row) continue;
      if (t.type === 'IN') row.in += Number(t.quantity) || 0;
      else row.out += Number(t.quantity) || 0;
    }
    return list;
  }, [transactions]);

  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.flatMap((d) => [d.in, d.out]));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  })();
  const totalIn = days.reduce((a, d) => a + d.in, 0);
  const totalOut = days.reduce((a, d) => a + d.out, 0);
  const H = 160;
  const shown = hover ?? null;
  const label = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <Card
      title="Stock in and out"
      note={`Last ${DAYS} days · ${formatQty(totalIn)} in, ${formatQty(totalOut)} out`}
      className="xl:col-span-3"
      right={
        <div className="flex gap-3 pt-1">
          <Key color={IN} label="In" />
          <Key color={OUT} label="Out" />
        </div>
      }
    >
      <div className="relative" onMouseLeave={() => setHover(null)}>
        {/* gridlines */}
        <div className="absolute inset-x-0 top-0" style={{ height: H }}>
          {[1, 0.5].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-slate-800" style={{ top: H - H * f }}>
              <span className="absolute right-0 -top-4 text-[11px] text-slate-600">{formatQty(nice * f)}</span>
            </div>
          ))}
        </div>
        <div className="relative flex items-end gap-1 sm:gap-1.5" style={{ height: H }} role="img" aria-label={`Stock in and out for the last ${DAYS} days`}>
          {days.map((d, i) => (
            <button
              key={d.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(hover === i ? null : i)}
              aria-label={`${label(d.date)}: ${formatQty(d.in)} in, ${formatQty(d.out)} out`}
              className={`relative flex-1 h-full flex items-end justify-center gap-[2px] rounded-md transition-colors ${shown === i ? 'bg-slate-850' : ''}`}
            >
              <span className="w-full max-w-[12px] rounded-t-[4px]" style={{ height: d.in ? Math.max(2, (d.in / nice) * H) : 0, background: IN }} />
              <span className="w-full max-w-[12px] rounded-t-[4px]" style={{ height: d.out ? Math.max(2, (d.out / nice) * H) : 0, background: OUT }} />
            </button>
          ))}
        </div>
        <div className="mt-1 border-t border-slate-700" />
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
          <span>{label(days[0].date)}</span>
          <span>{label(days[Math.floor(DAYS / 2)].date)}</span>
          <span>Today</span>
        </div>

        {shown !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-lg"
            style={{ left: `clamp(0px, calc(${((shown + 0.5) / DAYS) * 100}% - 60px), calc(100% - 120px))`, width: 120 }}
          >
            <p className="text-slate-300">{i18nDay(days[shown].date)}</p>
            <p className="mt-1 flex items-center justify-between gap-2 text-slate-100">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: IN }} />In</span>
              {formatQty(days[shown].in)}
            </p>
            <p className="flex items-center justify-between gap-2 text-slate-100">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: OUT }} />Out</span>
              {formatQty(days[shown].out)}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

const i18nDay = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** Products by stock state: one segmented bar, labelled. */
const Health: React.FC<{ products: Product[] }> = ({ products }) => {
  const counts = { ok: 0, low: 0, out: 0 };
  for (const p of products) counts[stockState(p)]++;
  const total = products.length || 1;
  const parts = [
    { key: 'ok' as const, label: 'In stock', n: counts.ok },
    { key: 'low' as const, label: 'Low', n: counts.low },
    { key: 'out' as const, label: 'Out', n: counts.out }
  ];
  const healthy = Math.round((counts.ok / total) * 100);
  return (
    <Card title="Stock health" note={`${healthy}% of products are above their minimum`} className="xl:col-span-2">
      <div className="flex h-3 gap-[2px] rounded-full overflow-hidden bg-slate-800">
        {parts.filter((p) => p.n > 0).map((p) => (
          <div key={p.key} style={{ width: `${(p.n / total) * 100}%`, background: STATUS[p.key] }} title={`${p.label}: ${p.n}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <li key={p.key} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS[p.key] }} />
              {p.label}
            </p>
            <p className="mt-1 text-xl leading-none font-semibold text-slate-100">{formatQty(p.n)}</p>
            <p className="mt-1 text-[11px] text-slate-500">{Math.round((p.n / total) * 100)}%</p>
          </li>
        ))}
      </ul>
    </Card>
  );
};

/** Horizontal bars with the value at the end. */
const Bars: React.FC<{ rows: { label: string; value: number; text: string; sub?: string }[]; color: string; empty: string }> = ({ rows, color, empty }) => {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-300">{r.label}</span>
            <span className="shrink-0 text-slate-100">
              {r.text}
              {r.sub && <span className="ml-1.5 text-xs text-slate-500">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

export const OverviewCharts: React.FC<Props> = ({ products, transactions, stores }) => {
  const active = useMemo(() => products.filter((p) => p.is_active !== false), [products]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of active) {
      const v = Math.max(0, Number(p.current_stock) || 0) * (Number(p.purchase_price) || 0);
      const c = p.category || 'Uncategorised';
      m.set(c, (m.get(c) || 0) + v);
    }
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) top.push(['Other', rest]);
    return top.filter(([, v]) => v > 0);
  }, [active]);
  const totalValue = byCategory.reduce((a, [, v]) => a + v, 0);

  const topOut = useMemo(() => {
    const since = Date.now() - 30 * 864e5;
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'OUT' || t.transfer_id || new Date(t.created_at).getTime() < since) continue;
      m.set(t.product_id, (m.get(t.product_id) || 0) + (Number(t.quantity) || 0));
    }
    const byId = new Map(products.map((p) => [p.id, p]));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, q]) => ({ p: byId.get(id), q }))
      .filter((x) => x.p);
  }, [transactions, products]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <DailyFlow transactions={transactions} />
      <Health products={active} />

      <Card title="Stock value by category" note={`${rs(totalValue)} at cost price`} className="xl:col-span-2">
        <Bars
          color={IN}
          empty="Add cost prices to see stock value"
          rows={byCategory.map(([c, v]) => ({ label: c, value: v, text: rs(v), sub: totalValue ? `${Math.round((v / totalValue) * 100)}%` : undefined }))}
        />
      </Card>

      <Card title="Most taken out" note="Last 30 days" className="xl:col-span-3">
        <Bars
          color={OUT}
          empty="No stock out in the last 30 days"
          rows={topOut.map(({ p, q }) => ({ label: p!.name, value: q, text: formatQty(q), sub: String(p!.unit || '') }))}
        />
      </Card>

      {stores.length > 1 && (
        <Card title="Stock by store" note="Units on shelves and their value at cost" className="xl:col-span-5">
          <Bars
            color={IN}
            empty="No stock recorded in any store"
            rows={stores.map((s) => ({ label: s.name, value: s.units, text: `${formatQty(s.units)} units`, sub: rs(s.value) }))}
          />
        </Card>
      )}
    </div>
  );
};
