import React from 'react';
import { 
  Package, 
  Layers, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  PlusCircle, 
  MinusCircle, 
  PackagePlus, 
  Search, 
  MapPin, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Product, StockTransaction, DashboardStats, UserRole } from '../../types/inventory';

interface DashboardViewProps {
  products: Product[];
  transactions: StockTransaction[];
  userRole: UserRole;
  onOpenStockIn: (product?: Product) => void;
  onOpenStockOut: (product?: Product) => void;
  onOpenAddProduct: () => void;
  onGoToProductsSearch: () => void;
  onSelectProduct: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  transactions,
  userRole,
  onOpenStockIn,
  onOpenStockOut,
  onOpenAddProduct,
  onGoToProductsSearch,
  onSelectProduct
}) => {
  // Compute Dashboard Statistics
  const activeProducts = products.filter((p) => p.is_active !== false);
  const totalProducts = activeProducts.length;
  const totalStockUnits = activeProducts.reduce((acc, p) => acc + (p.current_stock || 0), 0);
  
  const lowStockProducts = activeProducts.filter(
    (p) => p.current_stock > 0 && p.current_stock <= p.minimum_stock
  );
  const outOfStockProducts = activeProducts.filter((p) => p.current_stock === 0);

  // Today's Date Calculation (Local Timezone Safe)
  const isToday = (dateString: string) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const todaysTransactions = transactions.filter((t) => isToday(t.created_at));

  const stockAddedToday = todaysTransactions
    .filter((t) => t.type === 'IN')
    .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);

  const stockRemovedToday = todaysTransactions
    .filter((t) => t.type === 'OUT')
    .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* Header Greeting Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              Bahubali Enterprises Dashboard
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Hardware Hub
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time stock monitoring & inventory operations desk
          </p>
        </div>

        <button
          onClick={onGoToProductsSearch}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-200 rounded-xl text-sm font-semibold transition-all group"
        >
          <Search className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Quick Product Lookup</span>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Total Products */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Products</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-2">{totalProducts}</p>
          <p className="text-[10px] text-slate-500 mt-1">Active items in catalog</p>
        </div>

        {/* Total Stock Units */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Units</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-2">{totalStockUnits.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1">Items in stock</p>
        </div>

        {/* Low Stock Alert */}
        <div className={`border p-4 rounded-2xl relative overflow-hidden transition-all ${
          lowStockProducts.length > 0 
            ? 'bg-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-500/5' 
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Low Stock</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400 mt-2">{lowStockProducts.length}</p>
          <p className="text-[10px] text-amber-400/70 mt-1">Needs reordering</p>
        </div>

        {/* Out of Stock */}
        <div className={`border p-4 rounded-2xl relative overflow-hidden transition-all ${
          outOfStockProducts.length > 0 
            ? 'bg-rose-950/30 border-rose-500/40' 
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Out of Stock</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 mt-2">{outOfStockProducts.length}</p>
          <p className="text-[10px] text-rose-400/70 mt-1">Zero balance items</p>
        </div>

        {/* Stock Added Today */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Added Today</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">+{stockAddedToday}</p>
          <p className="text-[10px] text-slate-500 mt-1">Stock In additions</p>
        </div>

        {/* Stock Removed Today */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Issued Today</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 mt-2">-{stockRemovedToday}</p>
          <p className="text-[10px] text-slate-500 mt-1">Stock Out sales</p>
        </div>

      </div>

      {/* Large Touch-Friendly Quick Actions */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Quick Shop Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          
          {/* + STOCK IN Button */}
          {userRole === 'admin' ? (
            <button
              onClick={() => onOpenStockIn()}
              className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-extrabold shadow-lg shadow-emerald-700/20 hover:from-emerald-500 hover:to-emerald-600 active:scale-98 transition-all group"
            >
              <PlusCircle className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform stroke-[2.5]" />
              <span className="text-base tracking-wide">+ STOCK IN</span>
              <span className="text-[10px] text-emerald-100 font-normal mt-0.5">Receive New Items</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 font-bold opacity-75 cursor-not-allowed">
              <PlusCircle className="w-8 h-8 mb-2 stroke-[2]" />
              <span className="text-sm tracking-wide">+ STOCK IN</span>
              <span className="text-[10px] text-amber-500/80 font-mono mt-0.5">Admin Code Required</span>
            </div>
          )}

          {/* - STOCK OUT Button */}
          {userRole === 'admin' ? (
            <button
              onClick={() => onOpenStockOut()}
              className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-white font-extrabold shadow-lg shadow-rose-700/20 hover:from-rose-500 hover:to-rose-600 active:scale-98 transition-all group"
            >
              <MinusCircle className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform stroke-[2.5]" />
              <span className="text-base tracking-wide">− STOCK OUT</span>
              <span className="text-[10px] text-rose-100 font-normal mt-0.5">Issue to Customer</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 font-bold opacity-75 cursor-not-allowed">
              <MinusCircle className="w-8 h-8 mb-2 stroke-[2]" />
              <span className="text-sm tracking-wide">− STOCK OUT</span>
              <span className="text-[10px] text-amber-500/80 font-mono mt-0.5">Admin Code Required</span>
            </div>
          )}

          {/* ADD PRODUCT Button */}
          {userRole === 'admin' ? (
            <button
              onClick={onOpenAddProduct}
              className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 active:scale-98 transition-all group"
            >
              <PackagePlus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform stroke-[2.5]" />
              <span className="text-base tracking-wide">ADD PRODUCT</span>
              <span className="text-[10px] text-slate-900 font-medium mt-0.5">Create New SKU</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 font-bold opacity-75 cursor-not-allowed">
              <PackagePlus className="w-8 h-8 mb-2 stroke-[2]" />
              <span className="text-sm tracking-wide">ADD PRODUCT</span>
              <span className="text-[10px] text-amber-500/80 font-mono mt-0.5">Admin Code Required</span>
            </div>
          )}

          {/* SEARCH STOCK Button (Always Available for Staff) */}
          <button
            onClick={onGoToProductsSearch}
            className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 font-extrabold hover:bg-slate-850 hover:border-amber-500/50 active:scale-98 transition-all group"
          >
            <Search className="w-8 h-8 mb-2 text-amber-400 group-hover:scale-110 transition-transform stroke-[2.5]" />
            <span className="text-base tracking-wide">SEARCH STOCK</span>
            <span className="text-[10px] text-slate-400 font-normal mt-0.5">Find Item & Photo</span>
          </button>

        </div>
      </div>

      {/* Low Stock Warning Section */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Stock Alert & Low Inventory
                </h3>
                <p className="text-xs text-slate-400">
                  Items requiring immediate supplier reorder
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full">
              {lowStockProducts.length + outOfStockProducts.length} Items
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...outOfStockProducts, ...lowStockProducts].slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectProduct(item)}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-slate-900/50 group"
              >
                {/* Product Photo Thumbnail */}
                <div className="w-14 h-14 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-800 flex items-center justify-center relative">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-slate-600" />
                  )}
                  {item.current_stock === 0 ? (
                    <span className="absolute inset-0 bg-rose-950/70 flex items-center justify-center text-[9px] font-black text-rose-400 uppercase tracking-tighter">
                      OUT
                    </span>
                  ) : null}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                    {item.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium text-slate-400 truncate">
                      {item.brand}
                    </span>
                    <span className="text-[10px] text-slate-500">|</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Rack {item.rack || 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-extrabold text-amber-400">
                      Stock: {item.current_stock} {item.unit}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Min: {item.minimum_stock}
                    </span>
                  </div>
                </div>

                {/* Instant Reorder +Stock Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStockIn(item);
                  }}
                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex-shrink-0"
                  title="Stock In This Item"
                >
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">
            Recent Stock Movement Activity
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Live Feed
          </span>
        </div>

        <div className="space-y-2.5">
          {transactions.slice(0, 5).map((tx) => (
            <div
              key={tx.id}
              className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                  tx.type === 'IN' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : tx.type === 'OUT' 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {tx.type === 'IN' ? '+IN' : tx.type === 'OUT' ? '-OUT' : 'ADJ'}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {tx.product_name || 'Hardware Product'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {tx.user_name} • {tx.reason || 'Stock Update'}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-extrabold ${
                  tx.type === 'IN' ? 'text-emerald-400' : tx.type === 'OUT' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity} units
                </p>
                <p className="text-[10px] text-slate-400">
                  {tx.previous_stock} → {tx.new_stock}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-xs text-slate-500 py-3 text-center">No recent stock transactions recorded yet.</p>
          )}
        </div>
      </div>

    </div>
  );
};
