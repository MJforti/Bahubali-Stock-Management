import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, 
  X, 
  MapPin, 
  Tag, 
  PlusCircle, 
  MinusCircle, 
  Sliders, 
  Edit, 
  Clock, 
  Truck, 
  DollarSign, 
  Package, 
  AlertTriangle,
  History
} from 'lucide-react';
import { ProductPhoto } from '../ui/ProductThumb';
import { Product, StockTransaction, UserRole } from '../../types/inventory';

interface ProductDetailModalProps {
  product: Product | null;
  transactions: StockTransaction[];
  userRole: UserRole;
  onClose: () => void;
  onOpenStockIn: (product: Product) => void;
  onOpenStockOut: (product: Product) => void;
  onOpenAdjustment: (product: Product) => void;
  onOpenEditProduct: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  transactions,
  userRole,
  onClose,
  onOpenStockIn,
  onOpenStockOut,
  onOpenAdjustment,
  onOpenEditProduct
}) => {
  if (!product) return null;

  const productHistory = transactions.filter((t) => t.product_id === product.id);

  const isLow = product.current_stock > 0 && product.current_stock <= product.minimum_stock;
  const isOut = product.current_stock === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-100 bg-slate-850 border border-slate-800 px-2.5 py-1 rounded-lg">
              {product.brand}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              SKU: {product.sku}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenEditProduct(product)}
              className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-slate-100 border border-slate-800 transition-colors"
              title="Edit Product Details"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[85vh] overflow-y-auto">
          
          <div className="relative">
            <ProductPhoto src={product.image_url} alt={product.name} className="w-full h-64 rounded-2xl border border-slate-800" />
            {product.rack && <span className="rack-tag absolute top-3 right-3">{product.rack}</span>}
          </div>

          {/* Product Title & Category */}
          <div>
            <span className="text-xs font-medium text-slate-400">{product.category}{product.sub_category ? ` · ${product.sub_category}` : ''}</span>
            <h2 className="text-xl font-semibold text-slate-100 mt-0.5">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* Current Stock Banner & Quick Actions */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className={`flex items-center gap-1.5 text-sm ${isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-rose-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-[32px] leading-none font-semibold ${
                    isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-100'
                  }`}>
                    {product.current_stock}
                  </span>
                  <span className="text-base text-slate-400">{product.unit}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-medium text-slate-400">Minimum</span>
                <p className="text-lg font-semibold text-slate-300 mt-0.5">
                  {product.minimum_stock} {product.unit}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-850">
                <button
                  onClick={() => onOpenStockIn(product)}
                  className="h-11 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[15px] font-semibold transition-colors active:scale-[0.98]"
                >
                  <ArrowDownToLine className="w-4 h-4" strokeWidth={2} />
                  <span>Stock in</span>
                </button>

                <button
                  onClick={() => onOpenStockOut(product)}
                  className="h-11 flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 text-slate-100 border border-slate-700 rounded-xl text-[15px] font-medium transition-colors active:scale-[0.98]"
                >
                  <ArrowUpFromLine className="w-4 h-4" strokeWidth={1.5} />
                  <span>Stock out</span>
                </button>

                {userRole === 'admin' && (
                  <button
                    onClick={() => onOpenAdjustment(product)}
                    className="col-span-2 sm:col-span-1 h-11 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-100 hover:bg-slate-850 rounded-xl text-[15px] transition-colors"
                  >
                    <Sliders className="w-4 h-4" strokeWidth={1.5} />
                    <span>Correct count</span>
                  </button>
                )}
            </div>
          </div>

          {/* Grid Details (Prices, Supplier, Rack) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            
            {/* Selling Price */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-medium text-slate-500 block">Price</span>
              <span className="text-base font-semibold text-slate-100">₹{product.selling_price || 0}</span>
            </div>

            {/* Purchase Price */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-medium text-slate-500 block">Cost</span>
              <span className="text-base font-semibold text-slate-300">₹{product.purchase_price || 0}</span>
            </div>

            {/* Rack Location */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-medium text-slate-500 block">Rack</span>
              <span className="text-sm font-medium text-slate-200 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{product.rack || 'Unassigned'}</span>
              </span>
            </div>

            {/* Supplier */}
            <div className="col-span-2 sm:col-span-3 bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Supplier</span>
                  <span className="text-xs font-medium text-slate-200">{product.supplier || 'Not specified'}</span>
                </div>
              </div>
              <span className="text-xs text-slate-500">
                Updated {new Date(product.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>

          </div>

          {/* Product Specific History */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <h4 className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              <span>Recent movements</span>
            </h4>

            <div className="space-y-1.5">
              {productHistory.slice(0, 4).map((tx) => (
                <div key={tx.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
                  <div>
                    <span className={`font-medium ${
                      tx.type === 'IN' ? 'text-emerald-400' : tx.type === 'OUT' ? 'text-rose-400' : 'text-slate-100'
                    }`}>
                      {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '−' : 'Set to '}{tx.type === 'ADJUSTMENT' ? tx.new_stock : tx.quantity} {product.unit}
                    </span>
                    <span className="text-slate-500 text-xs ml-2">by {tx.user_name}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {productHistory.length === 0 && (
                <p className="text-xs text-slate-500">No movements for this product yet</p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
