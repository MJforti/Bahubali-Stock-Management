import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/sync';
import { formatQty } from '../ui/stock';

interface StoreDay {
  store: string;
  moves: number;
  in: number;
  out: number;
  moved_in: number;
  moved_out: number;
  corrections: number;
  top_out: { product: string; qty: number; unit: string }[];
  out_of_stock: number;
  low: number;
  restock: string[];
}
interface DaySummary {
  day: string;
  stores: StoreDay[];
  total_in: number;
  total_out: number;
  restock_out: number;
  restock_low: number;
}

const CACHE = 'bahubali_daily_summaries';

function readCache(): DaySummary[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || '[]');
  } catch {
    return [];
  }
}

const dayLabel = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** The 8 PM summaries, one card per day, one block per store where stock moved. */
export const DailySummaries: React.FC = () => {
  const [days, setDays] = useState<DaySummary[]>(readCache);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let live = true;
    supabase
      .from('daily_summaries')
      .select('data')
      .order('day', { ascending: false })
      .limit(90)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setOffline(true);
        else {
          const list = (data ?? []).map((r: any) => r.data as DaySummary);
          setDays(list);
          try {
            localStorage.setItem(CACHE, JSON.stringify(list));
          } catch {
            /* storage full: fine */
          }
        }
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (loading && days.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {offline && <p className="text-sm text-slate-500">Offline: showing the summaries saved on this phone</p>}
      {days.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
          <p className="text-base text-slate-200">No summaries yet</p>
          <p className="mt-1 text-sm text-slate-500">A summary is saved here every day at 8 PM</p>
        </div>
      ) : (
        days.map((d) => {
          const need = Number(d.restock_out) + Number(d.restock_low);
          return (
            <section key={d.day} className="rounded-2xl border border-slate-800 bg-slate-900">
              <header className="px-4 pt-4 pb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] text-slate-100">{dayLabel(d.day)}</h2>
                <p className="text-sm text-slate-400 whitespace-nowrap">
                  <span className="text-emerald-400">+{formatQty(d.total_in)}</span> <span className="text-slate-600">/</span>{' '}
                  <span className="text-rose-400">-{formatQty(d.total_out)}</span>
                </p>
              </header>

              {d.stores.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-slate-500">No stock moved this day</p>
              ) : (
                <ul className="border-t border-slate-800 divide-y divide-slate-800">
                  {d.stores.map((s) => (
                    <li key={s.store} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] text-slate-200 truncate">{s.store}</p>
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                          {s.moves} {s.moves === 1 ? 'entry' : 'entries'}
                          {s.corrections ? ` · ${s.corrections} ${s.corrections === 1 ? 'correction' : 'corrections'}` : ''}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1 text-slate-300">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                          In {formatQty(s.in)}
                        </span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" strokeWidth={2} />
                          Out {formatQty(s.out)}
                        </span>
                        {(s.moved_in > 0 || s.moved_out > 0) && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                            Transfer +{formatQty(s.moved_in)} / -{formatQty(s.moved_out)}
                          </span>
                        )}
                      </div>
                      {s.top_out.length > 0 && (
                        <p className="mt-1.5 text-sm text-slate-500">
                          Most out: {s.top_out.map((t) => `${t.product} (${formatQty(t.qty)})`).join(', ')}
                        </p>
                      )}
                      {s.restock.length > 0 && (
                        <p className="mt-1 text-sm text-slate-300">
                          <span className="inline-block w-1.5 h-1.5 mr-2 mb-[2px] rounded-full bg-amber-500 align-middle" />
                          Restock{s.out_of_stock ? ` · ${s.out_of_stock} out` : ''}
                          {s.low ? ` · ${s.low} low` : ''}: <span className="text-slate-400">{s.restock.slice(0, 5).join(', ')}{s.restock.length > 5 ? ` +${s.restock.length - 5}` : ''}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <p className="px-4 py-2.5 border-t border-slate-800 text-xs text-slate-500">
                {need ? `${need} ${need === 1 ? 'product' : 'products'} to restock across all stores` : 'Nothing to restock'}
              </p>
            </section>
          );
        })
      )}
    </div>
  );
};
