import React, { useMemo, useState } from 'react';
import { X, Search, Check, Warehouse, Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { MAIN_STORE_ID, Product, Store } from '../../types/inventory';
import { ALL_STORES, StoreScope, addStore, removeStore, renameStore, stockIn } from '../../lib/stores';
import { logActivity } from '../../lib/activity';
import { formatQty } from '../ui/stock';

interface StorePickerProps {
  stores: Store[];
  products: Product[];
  scope: StoreScope;
  isAdmin: boolean;
  onPick: (scope: StoreScope) => void;
  onClose: () => void;
}

/** "Select store": search, All stores, then each store. Admins can add, rename and remove stores. */
export const StorePicker: React.FC<StorePickerProps> = ({ stores, products, scope, isAdmin, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = stores.filter((s) => s.is_active);
  const shown = active.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const activeProducts = products.filter((p) => p.is_active !== false);

  const unitsIn = useMemo(() => {
    const m: Record<string, number> = { [ALL_STORES]: 0 };
    for (const s of active) m[s.id] = activeProducts.reduce((a, p) => a + Math.max(0, stockIn(p, s.id)), 0);
    m[ALL_STORES] = activeProducts.reduce((a, p) => a + Math.max(0, stockIn(p, ALL_STORES)), 0);
    return m;
  }, [active, activeProducts]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again');
    }
  };

  const row = (id: StoreScope, label: string, icon: React.ReactNode, store?: Store) => {
    const selected = scope === id;
    const isRenaming = store && renaming?.id === store.id;
    return (
      <li key={id} className="flex items-center gap-1">
        {isRenaming ? (
          <form
            className="flex-1 flex items-center gap-2 px-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const saved = await renameStore(store!, renaming!.name, stores);
                await logActivity('data.store_renamed', `Renamed ${store!.name} to ${saved.name}`);
                setRenaming(null);
              });
            }}
          >
            <input
              autoFocus
              value={renaming!.name}
              onChange={(e) => setRenaming({ id: store!.id, name: e.target.value })}
              maxLength={60}
              className="flex-1 h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-base text-slate-100 focus:outline-none focus:border-slate-500"
            />
            <button type="submit" className="h-11 px-3 rounded-lg bg-slate-100 text-slate-950 text-sm font-medium">Save</button>
          </form>
        ) : (
          <button
            onClick={() => !managing && onPick(id)}
            disabled={managing}
            className={`flex-1 min-h-12 px-3 rounded-xl flex items-center gap-3 text-left transition-colors ${
              selected && !managing ? 'bg-slate-850 text-slate-100' : 'text-slate-200 hover:bg-slate-850'
            }`}
          >
            <span className="w-8 h-8 shrink-0 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500">{icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] truncate">{label}</span>
              <span className="block text-xs text-slate-500">{formatQty(unitsIn[id] ?? 0)} units</span>
            </span>
            {selected && !managing && <Check className="w-4 h-4 text-slate-400" strokeWidth={1.5} />}
          </button>
        )}
        {managing && store && !isRenaming && (
          <>
            <button
              onClick={() => setRenaming({ id: store.id, name: store.name })}
              aria-label={`Rename ${store.name}`}
              className="w-10 h-10 rounded-lg text-slate-500 hover:text-slate-100 flex items-center justify-center transition-colors"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {store.id !== MAIN_STORE_ID && (
              <button
                onClick={() => {
                  const units = unitsIn[store.id] ?? 0;
                  const warn = units > 0 ? ` It still has ${formatQty(units)} units recorded; they stay in its history.` : '';
                  if (!window.confirm(`Remove ${store.name}?${warn}`)) return;
                  run(async () => {
                    await removeStore(store);
                    await logActivity('data.store_removed', `Removed store ${store.name}`);
                    if (scope === store.id) onPick(ALL_STORES);
                  });
                }}
                aria-label={`Remove ${store.name}`}
                className="w-10 h-10 rounded-lg text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </>
        )}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-5 pb-3">
          <h2 className="text-lg font-medium text-slate-100">{managing ? 'Manage stores' : 'Select store'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {!managing && active.length > 4 && (
          <label className="relative block px-5 pb-3">
            <span className="sr-only">Search store</span>
            <Search className="w-4 h-4 absolute left-8 top-1/2 -translate-y-[calc(50%+6px)] text-slate-500" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search store"
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </label>
        )}

        <ul className="px-3 overflow-y-auto">
          {!managing && !query && row(ALL_STORES, 'All stores', <Layers className="w-4 h-4" strokeWidth={1.5} />)}
          {shown.map((s) => row(s.id, s.name, <Warehouse className="w-4 h-4" strokeWidth={1.5} />, s))}
          {shown.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">No store called "{query}"</li>}
        </ul>

        <div className="p-5 pt-3 space-y-2 border-t border-slate-800 mt-2">
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {isAdmin && managing && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const s = await addStore(newName, stores);
                  await logActivity('data.store_added', `Added store ${s.name}`);
                  setNewName('');
                });
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New store or godown name"
                maxLength={60}
                className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-slate-950 border border-slate-800 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="h-11 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
                Add
              </button>
            </form>
          )}
          {isAdmin ? (
            <button
              onClick={() => {
                setManaging((m) => !m);
                setRenaming(null);
                setError(null);
              }}
              className="w-full h-9 text-sm text-slate-500 hover:text-slate-200 transition-colors"
            >
              {managing ? 'Done' : 'Add, rename or remove stores'}
            </button>
          ) : (
            <p className="text-center text-xs text-slate-500">Adding stores needs the admin code</p>
          )}
        </div>
      </div>
    </div>
  );
};
