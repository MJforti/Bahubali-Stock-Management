import React from 'react';
import { 
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {product.brand}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              SKU: {product.sku}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenEditProduct(product)}
              className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-amber-400 border border-slate-800 transition-colors"
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
          
          {/* Large High-Res Product Image */}
          <div className="w-full h-64 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative flex items-center justify-center">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-600">
                <Package className="w-16 h-16 mb-2" />
                <span className="text-xs font-medium">No photo uploaded</span>
              </div>
            )}

            {/* Status Overlay */}
            <div className="absolute top-3 left-3">
              {isOut ? (
                <span className="px-3 py-1 bg-rose-950/90 border border-rose-500/50 text-rose-400 text-xs font-black uppercase rounded-xl backdrop-blur-md">
                  Out of Stock
                </span>
              ) : isLow ? (
                <span className="px-3 py-1 bg-amber-950/90 border border-amber-500/50 text-amber-400 text-xs font-black uppercase rounded-xl backdrop-blur-md flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Low Stock Warning
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-xs font-black uppercase rounded-xl backdrop-blur-md">
                  In Stock
                </span>
              )}
            </div>
          </div>

          {/* Product Title & Category */}
          <div>
            <span className="text-xs font-bold text-slate-400">{product.category} {product.sub_category ? `> ${product.sub_category}` : ''}</span>
            <h2 className="text-xl font-extrabold text-slate-100 mt-0.5">
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
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Stock Available</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-3xl font-black ${
                    isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {product.current_stock}
                  </span>
                  <span className="text-base font-bold text-slate-300">{product.unit}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Min Threshold</span>
                <p className="text-lg font-extrabold text-slate-300 mt-0.5">
                  {product.minimum_stock} {product.unit}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-850">
              <button
                onClick={() => onOpenStockIn(product)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Stock In</span>
              </button>

              <button
                onClick={() => onOpenStockOut(product)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95"
              >
                <MinusCircle className="w-4 h-4" />
                <span>− Stock Out</span>
              </button>

              {userRole === 'admin' && (
                <button
                  onClick={() => onOpenAdjustment(product)}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-extrabold transition-all active:scale-95"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Adjust Stock</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid Details (Prices, Supplier, Rack) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            
            {/* Selling Price */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Selling Price</span>
              <span className="text-base font-black text-amber-400">₹{product.selling_price || 0}</span>
            </div>

            {/* Purchase Price */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Purchase Cost</span>
              <span className="text-base font-extrabold text-slate-300">₹{product.purchase_price || 0}</span>
            </div>

            {/* Rack Location */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Location Rack</span>
              <span className="text-sm font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{product.rack || 'Unassigned'}</span>
              </span>
            </div>

            {/* Supplier */}
            <div className="col-span-2 sm:col-span-3 bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Supplier / Vendor</span>
                  <span className="text-xs font-bold text-slate-200">{product.supplier || 'Not specified'}</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500">
                Updated: {new Date(product.updated_at).toLocaleDateString()}
              </span>
            </div>

          </div>

          {/* Product Specific History */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-400" />
              <span>Recent Transaction Logs</span>
            </h4>

            <div className="space-y-1.5">
              {productHistory.slice(0, 4).map((tx) => (
                <div key={tx.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
                  <div>
                    <span className={`font-bold ${
                      tx.type === 'IN' ? 'text-emerald-400' : tx.type === 'OUT' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {tx.type === 'IN' ? '+ ' : tx.type === 'OUT' ? '- ' : 'ADJ '}{tx.quantity} {product.unit}s
                    </span>
                    <span className="text-slate-500 text-[11px] ml-2">by {tx.user_name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {productHistory.length === 0 && (
                <p className="text-xs text-slate-500">No stock movements logged for this product yet.</p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
