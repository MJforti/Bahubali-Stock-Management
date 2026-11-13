import React, { useState } from 'react';
import { X, AlertTriangle, Check, Loader2, Package } from 'lucide-react';
import { ProductThumb } from '../ui/ProductThumb';
import { Product, Store } from '../../types/inventory';
import { stockIn } from '../../lib/stores';

interface StockAdjustmentModalProps {
  product: Product;
  stores: Store[];
  defaultStoreId: string;
  onClose: () => void;
  onConfirm: (params: {
    product: Product;
    type: 'ADJUSTMENT';
    quantity: number;
    reason: string;
    storeId: string;
  }) => Promise<void>;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  product,
  stores,
  defaultStoreId,
  onClose,
  onConfirm
}) => {
  const activeStores = stores.filter((st) => st.is_active);
  const [storeId, setStoreId] = useState<string>(defaultStoreId);
  const recorded = stockIn(product, storeId);
  const [physicalStock, setPhysicalStock] = useState<number>(recorded);
  const [reason, setReason] = useState('Shelf count');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockDifference = physicalStock - recorded;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (physicalStock < 0) {
      setError('The count cannot be below zero');
      return;
    }

    if (!reason.trim()) {
      setError('Add a reason for the correction');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm({
        storeId,
        product,
        type: 'ADJUSTMENT',
        quantity: physicalStock,
        reason: reason.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Stock adjustment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <h2 className="text-lg font-medium text-slate-100">Correct stock count</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {activeStores.length > 1 && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">Store counted</span>
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setPhysicalStock(stockIn(product, e.target.value));
                  setError(null);
                }}
                aria-label="Store"
                className="h-10 min-w-0 max-w-[60%] px-3 rounded-lg bg-slate-950 border border-slate-700 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-slate-500"
              >
                {activeStores.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </label>
          )}
          
          {error && (
            <div className="p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Header Info */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <ProductThumb src={product.image_url} alt={product.name} size={48} />
            <div className="min-w-0">
              <span className="text-xs  text-slate-400">{product.brand}</span>
              <h3 className="text-xs font-medium text-slate-100 truncate">{product.name}</h3>
              <p className="text-xs text-slate-400">
                Recorded here: <span className="font-medium text-slate-200">{recorded} {product.unit}</span>
              </p>
            </div>
          </div>

          {/* Physical Count Input */}
          <div className="space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-medium text-slate-300 block">
              Counted on the shelf ({product.unit})
            </label>
            <input
              type="number"
              min="0"
              required
              value={physicalStock}
              onChange={(e) => setPhysicalStock(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-2xl font-semibold text-slate-100 text-center focus:outline-none focus:border-slate-600"
            />

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-400">Difference</span>
              <span className={`font-semibold ${
                stockDifference === 0 ? 'text-slate-400' : stockDifference > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {stockDifference > 0 ? `+${stockDifference}` : stockDifference} {product.unit}
              </span>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-100 block">
              Reason *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Monthly shelf count"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-semibold transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save count</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
