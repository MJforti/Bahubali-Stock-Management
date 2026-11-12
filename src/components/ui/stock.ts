import { Product } from '../../types/inventory';

export type StockState = 'ok' | 'low' | 'out';

export function stockState(p: Product): StockState {
  if (p.current_stock <= 0) return 'out';
  if (p.current_stock <= p.minimum_stock) return 'low';
  return 'ok';
}

/** Stock figure color: only low and out carry color, normal stock stays primary text. */
export const stockTextClass: Record<StockState, string> = {
  ok: 'text-slate-100',
  low: 'text-amber-400',
  out: 'text-rose-400'
};

export const stockLabel: Record<StockState, string> = {
  ok: 'In stock',
  low: 'Low stock',
  out: 'Out of stock'
};

export const stockDotClass: Record<StockState, string> = {
  ok: 'bg-emerald-400',
  low: 'bg-amber-400',
  out: 'bg-rose-400'
};

export function formatQty(n: number) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatPrice(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
