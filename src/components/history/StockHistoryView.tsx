import React, { useState, useMemo } from 'react';
import { History, Search, Filter, ArrowUpRight, ArrowDownLeft, Sliders, Calendar, User, Package } from 'lucide-react';
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

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>Stock Movement History Audit Log</span>
          </h2>
          <p className="text-xs text-slate-400">
            Immutable audit record of all Stock In, Stock Out, and Manual Adjustments
          </p>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-slate-900 border border-slate-800 text-amber-400 rounded-xl">
          {filteredTransactions.length} Total Logs
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product, user, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Transaction Types</option>
            <option value="IN">+ Stock In Only</option>
            <option value="OUT">− Stock Out Only</option>
            <option value="ADJUSTMENT">Manual Adjustments</option>
          </select>
        </div>

        {/* User Filter */}
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
          >
            {usersList.map((u) => (
              <option key={u} value={u}>{u === 'ALL' ? 'All Staff Members' : u}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Transactions Feed */}
      <div className="space-y-2.5">
        {filteredTransactions.map((tx) => {
          const isAdd = tx.type === 'IN';
          const isOut = tx.type === 'OUT';

          return (
            <div
              key={tx.id}
              className="p-3.5 bg-slate-900/90 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                
                {/* Type Icon Badge */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
                  isAdd
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isOut
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {isAdd ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : isOut ? (
                    <ArrowUpRight className="w-5 h-5" />
                  ) : (
                    <Sliders className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      isAdd
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isOut
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {tx.type}
                    </span>
                    <h3 className="text-sm font-bold text-slate-100 truncate">
                      {tx.product_name || 'Hardware Product'}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-400">
                    By <span className="text-amber-400 font-bold">{tx.user_name}</span> • {tx.reason || 'Stock Register Log'}
                    {tx.reference ? ` (Ref: ${tx.reference})` : ''}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{new Date(tx.created_at).toLocaleString()}</span>
                  </div>
                </div>

              </div>

              {/* Quantity Shift Display */}
              <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-slate-850">
                <div className="text-right">
                  <span className={`text-base font-black ${
                    isAdd ? 'text-emerald-400' : isOut ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {isAdd ? '+' : isOut ? '-' : ''}{tx.quantity} units
                  </span>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Stock: {tx.previous_stock} → {tx.new_stock}
                  </p>
                </div>
              </div>

            </div>
          );
        })}

        {filteredTransactions.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <History className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-xs font-semibold">No stock transactions found for the selected filters.</p>
          </div>
        )}
      </div>

    </div>
  );
};
