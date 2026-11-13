import React, { useState } from 'react';
import { X, Search, PlusCircle, MinusCircle, Package, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { ProductThumb } from '../ui/ProductThumb';
import { Product, Store, TransactionType } from '../../types/inventory';
import { stockIn } from '../../lib/stores';

interface StockMovementModalProps {
  initialType?: TransactionType;
  initialProduct?: Product | null;
  products: Product[];
  stores: Store[];
  defaultStoreId: string;
  onClose: () => void;
  onConfirm: (params: {
    product: Product;
    type: TransactionType;
    quantity: number;
    reason?: string;
    reference?: string;
    storeId: string;
  }) => Promise<void>;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  initialType = 'IN',
  initialProduct = null,
  products,
  stores,
  defaultStoreId,
  onClose,
  onConfirm
}) => {
  const activeStores = stores.filter((st) => st.is_active);
  const [storeId, setStoreId] = useState<string>(defaultStoreId);
  const here = (p: Product) => stockIn(p, storeId);
  const [type, setType] = useState<TransactionType>(initialType === 'ADJUSTMENT' ? 'IN' : initialType);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct);
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter products for selection step
  const searchResults = products.filter((p) => {
    if (!p.is_active) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.rack || '').toLowerCase().includes(q)
    );
  });

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setError(null);
  };

  const handleQuickAdd = (amount: number) => {
    setQuantity((prev) => Math.max(1, prev + amount));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Pick a product first');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be more than zero');
      return;
    }

    // Negative stock check
    if (type === 'OUT' && here(selectedProduct) < quantity) {
      setError(`Cannot issue ${quantity} ${selectedProduct.unit}. This store has only ${here(selectedProduct)}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm({
        storeId,
        product: selectedProduct,
        type,
        quantity,
        reason: reason.trim(),
        reference: reference.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentStockNum = selectedProduct ? here(selectedProduct) : 0;
  const qtyNum = Number(quantity) || 0;

  const newCalculatedStock = selectedProduct
    ? type === 'IN'
      ? currentStockNum + qtyNum
      : Math.max(0, currentStockNum - qtyNum)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header with Type Selector */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setType('IN'); setError(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                type === 'IN'
                  ? 'bg-slate-850 text-slate-100 border border-slate-700'
                  : 'border border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Stock in</span>
            </button>

            <button
              onClick={() => { setType('OUT'); setError(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                type === 'OUT'
                  ? 'bg-slate-850 text-slate-100 border border-slate-700'
                  : 'border border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>Stock out</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {activeStores.length > 1 && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">{type === 'IN' ? 'Into store' : 'From store'}</span>
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
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
            <div className="p-3 bg-rose-950 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select Product if not already selected */}
          {!selectedProduct ? (
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-300 block">
                {type === 'IN' ? 'Which product came in?' : 'Which product is going out?'}
              </label>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Name, brand or rack"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectProduct(item)}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 cursor-pointer transition-colors hover:bg-slate-900"
                  >
                    <ProductThumb src={item.image_url} alt={item.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.brand}{item.rack ? ` · ${item.rack}` : ''}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-100">
                      {here(item)} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* STEP 2: Product Visual Confirmation & Quantity Input */
            <div className="space-y-4">
              
              {/* Product Confirmation Header Box */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductThumb src={selectedProduct.image_url} alt={selectedProduct.name} size={64} />
                  <div className="min-w-0">
                    <span className="text-xs  text-slate-400">{selectedProduct.brand}</span>
                    <h3 className="text-sm font-medium text-slate-100 truncate">{selectedProduct.name}</h3>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      In stock here: <span className="font-semibold text-slate-100">{currentStockNum} {selectedProduct.unit}</span>
                      {selectedProduct.rack ? ` • Rack ${selectedProduct.rack}` : ''}
                    </p>
                  </div>
                </div>

                {!initialProduct && (
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs text-slate-300 hover:underline font-medium flex-shrink-0"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Quantity Input & Chips */}
              <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-xs font-medium text-slate-300 block">
                  {type === 'IN' ? 'Quantity received' : 'Quantity going out'}
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="One less"
                    className="w-12 h-12 shrink-0 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xl hover:bg-slate-800 active:scale-[0.98] transition-colors"
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    inputMode="decimal"
                    className="flex-1 min-w-0 w-full h-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-2xl font-semibold text-slate-100 focus:outline-none focus:border-slate-600"
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="One more"
                    className="w-12 h-12 shrink-0 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xl hover:bg-slate-800 active:scale-[0.98] transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Quick Increment Chips */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  {[5, 10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(amt)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                {/* New Stock Preview Calculation */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-850 text-xs">
                  <span className="text-slate-400">New stock</span>
                  <span className={`font-semibold text-sm ${
                    newCalculatedStock < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {currentStockNum} → {newCalculatedStock} {selectedProduct.unit}
                  </span>
                </div>
              </div>

              {/* Optional References */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Invoice or reference (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9021 or Bill #12"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-sm text-slate-100 focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Reason or customer (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Walk-in customer"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-sm text-slate-100 focus:outline-none focus:border-slate-600"
                  />
                </div>
              </div>

            </div>
          )}

          {/* Confirm Button */}
          {selectedProduct && (
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 border border-slate-800 text-slate-300 rounded-xl text-[15px] hover:bg-slate-850 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="h-11 flex items-center gap-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[15px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{type === 'IN' ? 'Confirm stock in' : 'Confirm stock out'}</span>
                  </>
                )}
              </button>
            </div>
          )}

        </form>

      </div>
    </div>
  );
};
