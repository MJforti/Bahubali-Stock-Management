import React, { useState } from 'react';
import { X, Search, PlusCircle, MinusCircle, Package, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Product, TransactionType } from '../../types/inventory';

interface StockMovementModalProps {
  initialType?: TransactionType;
  initialProduct?: Product | null;
  products: Product[];
  onClose: () => void;
  onConfirm: (params: {
    product: Product;
    type: TransactionType;
    quantity: number;
    reason?: string;
    reference?: string;
  }) => Promise<void>;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  initialType = 'IN',
  initialProduct = null,
  products,
  onClose,
  onConfirm
}) => {
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
      setError('Please select a product first.');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    // Negative stock check
    if (type === 'OUT' && selectedProduct.current_stock < quantity) {
      setError(`Cannot issue ${quantity} ${selectedProduct.unit}(s). Only ${selectedProduct.current_stock} in stock!`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm({
        product: selectedProduct,
        type,
        quantity,
        reason: reason.trim() || (type === 'IN' ? 'Stock In Addition' : 'Stock Out Issue'),
        reference: reference.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentStockNum = Number(selectedProduct?.current_stock) || 0;
  const qtyNum = Number(quantity) || 0;

  const newCalculatedStock = selectedProduct
    ? type === 'IN'
      ? currentStockNum + qtyNum
      : Math.max(0, currentStockNum - qtyNum)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Type Selector */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setType('IN'); setError(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                type === 'IN'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ STOCK IN</span>
            </button>

            <button
              onClick={() => { setType('OUT'); setError(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                type === 'OUT'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>− STOCK OUT</span>
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
          
          {error && (
            <div className="p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select Product if not already selected */}
          {!selectedProduct ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Select Product to {type === 'IN' ? 'Receive' : 'Issue'}
              </label>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by name, brand, or rack (e.g. Bosch, 8mm)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectProduct(item)}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:bg-slate-900"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-100 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.brand} • Rack {item.rack || 'N/A'}</p>
                    </div>
                    <span className="text-xs font-black text-amber-400">
                      {item.current_stock} {item.unit}
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
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-amber-400 uppercase">{selectedProduct.brand}</span>
                    <h3 className="text-sm font-bold text-slate-100 truncate">{selectedProduct.name}</h3>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      Current Stock: <span className="font-extrabold text-amber-400">{selectedProduct.current_stock} {selectedProduct.unit}</span>
                      {selectedProduct.rack ? ` • Rack ${selectedProduct.rack}` : ''}
                    </p>
                  </div>
                </div>

                {!initialProduct && (
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs text-amber-400 hover:underline font-bold flex-shrink-0"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Quantity Input & Chips */}
              <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Quantity to {type === 'IN' ? 'Add (+)' : 'Issue (−)'}
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xl font-bold hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 py-2 text-center bg-slate-900 border border-slate-800 rounded-xl text-2xl font-black text-amber-400 focus:outline-none focus:border-amber-500"
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xl font-bold hover:bg-slate-800 active:scale-95 transition-all"
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
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                {/* New Stock Preview Calculation */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-850 text-xs">
                  <span className="text-slate-400">Resulting Stock Balance:</span>
                  <span className={`font-black text-sm ${
                    newCalculatedStock < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {selectedProduct.current_stock} → {newCalculatedStock} {selectedProduct.unit}
                  </span>
                </div>
              </div>

              {/* Optional References */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Invoice / Ref No (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9021 or Bill #12"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Reason / Customer (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Customer Cash Sale"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
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
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all ${
                  type === 'IN'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Stock...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>CONFIRM {type === 'IN' ? 'STOCK IN' : 'STOCK OUT'}</span>
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
