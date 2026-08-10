import React, { useState } from 'react';
import { X, Sliders, AlertTriangle, Check, Loader2, Package } from 'lucide-react';
import { Product } from '../../types/inventory';

interface StockAdjustmentModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (params: {
    product: Product;
    type: 'ADJUSTMENT';
    quantity: number;
    reason: string;
  }) => Promise<void>;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  product,
  onClose,
  onConfirm
}) => {
  const [physicalStock, setPhysicalStock] = useState<number>(product.current_stock);
  const [reason, setReason] = useState('Physical stock count verification');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockDifference = physicalStock - product.current_stock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (physicalStock < 0) {
      setError('Physical stock cannot be negative.');
      return;
    }

    if (!reason.trim()) {
      setError('A mandatory audit reason is required for manual stock adjustments.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Admin Stock Reconciliation</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Header Info */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-6 h-6 text-slate-600" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-amber-400 uppercase">{product.brand}</span>
              <h3 className="text-xs font-bold text-slate-100 truncate">{product.name}</h3>
              <p className="text-[11px] text-slate-400">
                System Stock: <span className="font-bold text-slate-200">{product.current_stock} {product.unit}</span>
              </p>
            </div>
          </div>

          {/* Physical Count Input */}
          <div className="space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Actual Physical Count ({product.unit})
            </label>
            <input
              type="number"
              min="0"
              required
              value={physicalStock}
              onChange={(e) => setPhysicalStock(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-2xl font-black text-amber-400 text-center focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-400">Adjustment Variance:</span>
              <span className={`font-black ${
                stockDifference === 0 ? 'text-slate-400' : stockDifference > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {stockDifference > 0 ? `+${stockDifference}` : stockDifference} {product.unit}
              </span>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
              Mandatory Audit Reason *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Physical inventory verification audit count"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adjusting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirm Adjustment</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
