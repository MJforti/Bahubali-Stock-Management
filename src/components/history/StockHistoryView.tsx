import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { ProductThumb } from '../ui/ProductThumb';
import { formatQty } from '../ui/stock';
import { StockTransaction, TransactionType } from '../../types/inventory';

interface StockHistoryViewProps {
  transactions: StockTransaction[];
}

export const StockHistoryView: React.FC<StockHistoryViewProps> = ({ transactions }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');

  const usersList = useMemo(() => {
    const set = new Set(transactions.map((t) => t.user_name).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((t) => {
      // Type filter
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;

      // User filter
      if (selectedUser !== 'ALL' && t.user_name !== selectedUser) return false;

      // Query matching product name, SKU, brand, reason, reference
      if (q) {
        const prodMatch = (t.product_name || '').toLowerCase().includes(q);
        const skuMatch = (t.product_sku || '').toLowerCase().includes(q);
        const brandMatch = (t.product_brand || '').toLowerCase().includes(q);
        const userMatch = (t.user_name || '').toLowerCase().includes(q);
        const reasonMatch = (t.reason || '').toLowerCase().includes(q);
        const refMatch = (t.reference || '').toLowerCase().includes(q);

        return prodMatch || skuMatch || brandMatch || userMatch || reasonMatch || refMatch;
      }

      return true;
    });
  }, [transactions, searchQuery, selectedType, selectedUser]);

  // Group into days for a register-like reading
  const groups = useMemo(() => {
    const map = new Map<string, StockTransaction[]>();
    filteredTransactions.forEach((t) => {
      const key = new Date(t.created_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [filteredTransactions]);

  const dayLabel = (key: string) => {
    const d = new Date(key);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const control =
    'h-10 w-full rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-slate-600';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] leading-tight font-medium text-slate-100">History</h1>
        <p className="mt-1 text-sm text-slate-500">Every stock in, stock out and count correction, newest first</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
          <input
            type="search"
            placeholder="Product, person or reason"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${control} pl-9 pr-3 placeholder-slate-500`}
          />
        </label>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} aria-label="Type" className={`${control} px-3`}>
          <option value="ALL">All movements</option>
          <option value="IN">Stock in</option>
          <option value="OUT">Stock out</option>
          <option value="ADJUSTMENT">Count corrections</option>
        </select>
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} aria-label="Person" className={`${control} px-3`}>
          {usersList.map((u) => (
            <option key={u} value={u}>{u === 'ALL' ? 'Everyone' : u}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
          <p className="text-base text-slate-200">{transactions.length ? 'Nothing matches these filters' : 'No movements yet'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {transactions.length ? 'Try another word or filter' : 'Stock ins and stock outs are recorded here automatically'}
          </p>
        </div>
      ) : (
        groups.map(([key, items]) => (
          <section key={key}>
            <h2 className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-slate-300">{dayLabel(key)}</span>
              <span className="text-slate-500">{items.length} movements</span>
            </h2>
            <ul className="rounded-2xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
              {items.map((tx) => {
                const isIn = tx.type === 'IN';
                const isOut = tx.type === 'OUT';
                const sign = isIn ? '+' : isOut ? '−' : '';
                const tone = isIn ? 'text-emerald-400' : isOut ? 'text-rose-400' : 'text-slate-100';
                const kind = isIn ? 'Stock in' : isOut ? 'Stock out' : 'Count corrected';
                const time = new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <ProductThumb src={tx.product_image} alt={tx.product_name || 'Product'} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-slate-100 truncate">{tx.product_name || 'Product'}</p>
                      <p className="mt-0.5 text-sm text-slate-500 truncate">
                        {kind} · {tx.user_name}
                        {tx.reason ? ` · ${tx.reason}` : ''}
                        {tx.reference ? ` · Ref ${tx.reference}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[15px] font-semibold ${tone}`}>
                        {sign}{formatQty(tx.quantity)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatQty(tx.previous_stock)} → {formatQty(tx.new_stock)} · {time}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};
