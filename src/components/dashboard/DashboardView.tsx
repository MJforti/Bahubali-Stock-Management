import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, PackagePlus, Search, Plus, ChevronRight } from 'lucide-react';
import { Product, StockTransaction, UserRole } from '../../types/inventory';
import { ProductThumb } from '../ui/ProductThumb';
import { formatQty, stockState, stockTextClass, SHOW_MONEY } from '../ui/stock';
import { OverviewCharts, StoreFigure } from './OverviewCharts';

interface DashboardViewProps {
  products: Product[];
  transactions: StockTransaction[];
  userRole: UserRole;
  scopeLabel: string;
  canTransfer: boolean;
  onOpenTransfer: () => void;
  onOpenStockIn: (product?: Product) => void;
  onOpenStockOut: (product?: Product) => void;
  onOpenAddProduct: () => void;
  onGoToProductsSearch: () => void;
  onSelectProduct: (product: Product) => void;
  storeFigures: StoreFigure[];
}

const isToday = (iso: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
};

const Stat: React.FC<{ label: string; value: string; note: string; tone?: string }> = ({ label, value, note, tone = 'text-slate-100' }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
    <p className="text-sm text-slate-400">{label}</p>
    <p className={`mt-2 text-2xl leading-none font-semibold tabular-nums ${tone}`}>{value}</p>
    <p className="mt-2 text-xs text-slate-500">{note}</p>
  </div>
);

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  transactions,
  userRole,
  scopeLabel,
  canTransfer,
  onOpenTransfer,
  onOpenStockIn,
  onOpenStockOut,
  onOpenAddProduct,
  onGoToProductsSearch,
  onSelectProduct,
  storeFigures
}) => {
  const isAdmin = userRole === 'admin';
  const active = products.filter((p) => p.is_active !== false);
  const totalUnits = active.reduce((acc, p) => acc + (p.current_stock || 0), 0);
  const stockValue = active.reduce((acc, p) => acc + Math.max(0, Number(p.current_stock) || 0) * (Number(p.purchase_price) || 0), 0);
  const low = active.filter((p) => stockState(p) === 'low');
  const out = active.filter((p) => stockState(p) === 'out');
  const reorder = [...out, ...low];

  // Transfers between stores aren't goods received or issued, so they're left out here
  const today = transactions.filter((t) => isToday(t.created_at) && !t.transfer_id);
  const unitsIn = today.filter((t) => t.type === 'IN').reduce((a, t) => a + (Number(t.quantity) || 0), 0);
  const unitsOut = today.filter((t) => t.type === 'OUT').reduce((a, t) => a + (Number(t.quantity) || 0), 0);
  const movesIn = today.filter((t) => t.type === 'IN').length;
  const movesOut = today.filter((t) => t.type === 'OUT').length;

  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const secondaryBtn =
    'h-12 px-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-100 text-[15px] font-medium flex items-center gap-3 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-medium text-slate-100">Stock overview</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLabel} · {scopeLabel}</p>
        </div>
        <button
          onClick={onGoToProductsSearch}
          className="h-11 sm:w-72 px-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-500 text-[15px] flex items-center gap-2.5 transition-colors"
        >
          <Search className="w-[18px] h-[18px]" strokeWidth={1.5} />
          Search by name, brand or rack
        </button>
      </div>

      {/* Figures */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* Lead figure */}
        <div className="col-span-2 md:col-span-4 xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between gap-4">
          <p className="text-sm text-slate-400">Units on shelves</p>
          <div className="flex items-end justify-between gap-4">
            <p className="text-[40px] leading-none font-semibold tabular-nums text-slate-100">{formatQty(totalUnits)}</p>
            <div className="text-right text-sm">
              <p className="text-slate-200 tabular-nums">{formatQty(active.length)} products</p>
              {SHOW_MONEY && <p className="mt-0.5 text-slate-500 tabular-nums">{inr(stockValue)} at cost</p>}
            </div>
          </div>
        </div>
        <Stat label="Low stock" value={formatQty(low.length)} note="At or under minimum" tone={low.length ? 'text-amber-400' : undefined} />
        <Stat label="Out of stock" value={formatQty(out.length)} note="None left" tone={out.length ? 'text-rose-400' : undefined} />
        <Stat label="Received today" value={formatQty(unitsIn)} note={movesIn === 1 ? '1 stock in' : `${movesIn} stock ins`} />
        <Stat label="Issued today" value={formatQty(unitsOut)} note={movesOut === 1 ? '1 stock out' : `${movesOut} stock outs`} />
      </section>

      {/* Actions */}
      <section>
        <div className={`grid grid-cols-2 gap-3 ${canTransfer ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <button
            onClick={() => onOpenStockIn()}
            className="h-12 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[15px] font-semibold flex items-center gap-3 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            <ArrowDownToLine className="w-[18px] h-[18px]" strokeWidth={2} />
            Stock in
          </button>
          <button onClick={() => onOpenStockOut()} className={secondaryBtn}>
            <ArrowUpFromLine className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />
            Stock out
          </button>
          {canTransfer && (
            <button onClick={onOpenTransfer} className={`${secondaryBtn} col-span-2 lg:col-span-1`}>
              <ArrowLeftRight className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />
              Transfer
            </button>
          )}
          <button onClick={onOpenAddProduct} disabled={!isAdmin} className={secondaryBtn}>
            <PackagePlus className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />
            Add product
          </button>
          <button onClick={onGoToProductsSearch} className={secondaryBtn}>
            <Search className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />
            Find a product
          </button>
        </div>
        {!isAdmin && (
          <p className="mt-3 text-sm text-slate-500">Adding new products needs the admin code</p>
        )}
      </section>

      {/* Charts */}
      <OverviewCharts products={products} transactions={transactions} stores={storeFigures} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Reorder list */}
        <section className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900">
          <header className="flex items-baseline justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-medium text-slate-100">To reorder</h2>
            <span className="text-sm text-slate-500">{reorder.length} items</span>
          </header>
          {reorder.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-slate-500">Every product is above its minimum</p>
          ) : (
            <ul className="px-2 pb-2">
              {reorder.map((item) => {
                const state = stockState(item);
                return (
                  <li key={item.id}>
                    <div
                      onClick={() => onSelectProduct(item)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-850 cursor-pointer transition-colors"
                    >
                      <ProductThumb src={item.image_url} alt={item.name} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-slate-100 truncate">{item.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                          <span className="truncate">{item.brand}</span>
                          {item.rack && <span className="rack-tag">{item.rack}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg leading-none font-semibold ${stockTextClass[state]}`}>{formatQty(item.current_stock)}</p>
                        <p className="mt-1 text-xs text-slate-500">min {formatQty(item.minimum_stock)}</p>
                      </div>
                      {(
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenStockIn(item);
                          }}
                          title="Stock in"
                          className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent movements */}
        <section className="xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-900">
          <header className="flex items-baseline justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-medium text-slate-100">Recent movements</h2>
            <span className="text-sm text-slate-500">{transactions.length} recorded</span>
          </header>
          {transactions.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-slate-500">Stock ins and stock outs will appear here</p>
          ) : (
            <ul className="px-2 pb-2">
              {transactions.slice(0, 7).map((tx) => {
                const prod = products.find((p) => p.id === tx.product_id);
                const name = prod?.name || tx.product_name || 'Product';
                const sign = tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '−' : '';
                const tone = tx.type === 'IN' ? 'text-emerald-400' : tx.type === 'OUT' ? 'text-rose-400' : 'text-slate-100';
                const time = new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
                const day = isToday(tx.created_at) ? time : new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                const kind = tx.transfer_id ? (tx.type === 'OUT' ? 'Transfer out' : 'Transfer in') : tx.type === 'IN' ? 'Stock in' : tx.type === 'OUT' ? 'Stock out' : 'Count corrected';
                return (
                  <li key={tx.id}>
                    <div
                      onClick={() => prod && onSelectProduct(prod)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-850 cursor-pointer transition-colors"
                    >
                      <ProductThumb src={prod?.image_url || tx.product_image} alt={name} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-slate-100 truncate">{name}</p>
                        <p className="mt-0.5 text-sm text-slate-500 truncate">
                          {kind} · {tx.user_name || 'Staff'}{tx.reference ? ` · ${tx.reference}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[15px] font-semibold ${tone}`}>
                          {sign}{formatQty(tx.quantity)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatQty(tx.previous_stock)} → {formatQty(tx.new_stock)} · {day}
                        </p>
                      </div>
                      <ChevronRight className="hidden sm:block w-4 h-4 text-slate-600" strokeWidth={1.5} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
