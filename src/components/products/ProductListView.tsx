import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Package, 
  MapPin, 
  ArrowUpDown, 
  PlusCircle, 
  MinusCircle, 
  Tag, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Upload,
  Download,
  Edit2
} from 'lucide-react';
import { Product, UserRole } from '../../types/inventory';

interface ProductListViewProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  userRole: UserRole;
  onSelectProduct: (product: Product) => void;
  onOpenAddProduct: () => void;
  onOpenStockIn: (product: Product) => void;
  onOpenStockOut: (product: Product) => void;
  onOpenEditProduct: (product: Product) => void;
  onOpenImportModal: () => void;
  onExportExcel: () => void;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  products,
  searchQuery,
  onSearchChange,
  userRole,
  onSelectProduct,
  onOpenAddProduct,
  onOpenStockIn,
  onOpenStockOut,
  onOpenEditProduct,
  onOpenImportModal,
  onExportExcel
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Categories & Brands list computation
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.brand).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // High-Speed Multi-Field Search & Filter
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (p.is_active === false) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;

      // Brand filter
      if (selectedBrand !== 'ALL' && p.brand !== selectedBrand) return false;

      // Stock status filter
      if (stockStatusFilter === 'LOW_STOCK') {
        if (!(p.current_stock > 0 && p.current_stock <= p.minimum_stock)) return false;
      } else if (stockStatusFilter === 'OUT_OF_STOCK') {
        if (p.current_stock > 0) return false;
      } else if (stockStatusFilter === 'IN_STOCK') {
        if (p.current_stock === 0) return false;
      }

      // Query Search matching Name, Brand, SKU, Category, Rack, Description
      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const brandMatch = p.brand.toLowerCase().includes(q);
        const skuMatch = p.sku.toLowerCase().includes(q);
        const catMatch = p.category.toLowerCase().includes(q);
        const rackMatch = (p.rack || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const suppMatch = (p.supplier || '').toLowerCase().includes(q);

        return nameMatch || brandMatch || skuMatch || catMatch || rackMatch || descMatch || suppMatch;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedBrand, stockStatusFilter]);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <span>Hardware Catalog</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
              {filteredProducts.length} Products
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Image-first product cards & live stock count
          </p>
        </div>

        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <button
              onClick={onOpenImportModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Import</span>
            </button>
          )}

          <button
            onClick={onExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={onOpenAddProduct}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-extrabold shadow-md shadow-amber-500/10 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="relative md:hidden">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, brand, SKU, or rack..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Brand & Stock Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        
        {/* Brand Dropdown */}
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">Brand:</span>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500"
          >
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Stock Filter Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStockStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              stockStatusFilter === 'ALL' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStockStatusFilter('IN_STOCK')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              stockStatusFilter === 'IN_STOCK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setStockStatusFilter('LOW_STOCK')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              stockStatusFilter === 'LOW_STOCK' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              stockStatusFilter === 'OUT_OF_STOCK' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Out of Stock
          </button>
        </div>

      </div>

      {/* Image-First Product Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {filteredProducts.map((product) => {
          const isLow = product.current_stock > 0 && product.current_stock <= product.minimum_stock;
          const isOut = product.current_stock === 0;

          return (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex flex-col group"
            >
              {/* IMAGE FIRST - PROMINENT PRODUCT PHOTO */}
              <div className="w-full h-44 bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600">
                    <Package className="w-10 h-10 mb-1" />
                    <span className="text-[10px] font-semibold">No Image</span>
                  </div>
                )}

                {/* Stock Status Badge Overlay */}
                <div className="absolute top-2.5 left-2.5">
                  {isOut ? (
                    <span className="px-2 py-1 bg-rose-950/90 border border-rose-500/50 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-lg backdrop-blur-md">
                      Out of Stock
                    </span>
                  ) : isLow ? (
                    <span className="px-2 py-1 bg-amber-950/90 border border-amber-500/50 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-lg backdrop-blur-md flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Low Stock
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg backdrop-blur-md">
                      In Stock
                    </span>
                  )}
                </div>

                {/* Rack Location Badge */}
                {product.rack && (
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-slate-950/80 border border-slate-700 text-amber-300 text-[10px] font-bold rounded-md backdrop-blur-md flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span>Rack {product.rack}</span>
                  </div>
                )}
              </div>

              {/* PRODUCT DETAILS */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-amber-400 font-bold uppercase tracking-wide">
                    <span>{product.brand}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{product.sku}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-2 mt-0.5">
                    {product.name}
                  </h3>
                </div>

                {/* Stock Count Display */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Available</span>
                    <span className={`text-base font-black ${
                      isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {product.current_stock} <span className="text-xs font-bold text-slate-400">{product.unit}</span>
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Price</span>
                    <span className="text-sm font-extrabold text-slate-200">
                      ₹{product.selling_price || 0}
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Stock In & Stock Out for Admin, View Details for Staff */}
                {userRole === 'admin' ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStockIn(product);
                      }}
                      className="flex items-center justify-center gap-1 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Stock In</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStockOut(product);
                      }}
                      className="flex items-center justify-center gap-1 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>− Stock Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onSelectProduct(product)}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>View Specifications & Location</span>
                  </button>
                )}

              </div>

            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No matching products found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keyword or selected category filter.
          </p>
          <button
            onClick={onOpenAddProduct}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition-colors"
          >
            + Add New Hardware Product
          </button>
        </div>
      )}

    </div>
  );
};
