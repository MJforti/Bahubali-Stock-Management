import React, { useState, useMemo } from 'react';
import { Search, Plus, Upload, Download, ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react';
import { Product, UserRole } from '../../types/inventory';
import { ProductThumb } from '../ui/ProductThumb';
import { formatPrice, formatQty, stockDotClass, stockLabel, stockState, stockTextClass } from '../ui/stock';

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
        if (p.current_stock <= 0) return false;
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

  const chip = (active: boolean) =>
    `h-8 px-3 rounded-lg text-sm whitespace-nowrap border transition-colors ${
      active ? 'bg-slate-850 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-100'
    }`;
  const toolBtn =
    'h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 text-sm flex items-center gap-2 transition-colors active:scale-[0.98]';

  const statusFilters: { id: typeof stockStatusFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'IN_STOCK', label: 'In stock' },
    { id: 'LOW_STOCK', label: 'Low' },
    { id: 'OUT_OF_STOCK', label: 'Out' }
  ];

  return (
    <div className="space-y-5">
      {/* Title and tools */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-medium text-slate-100">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filteredProducts.length} of {products.filter((p) => p.is_active !== false).length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <button onClick={onOpenImportModal} className={toolBtn}>
              <Upload className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
              Import
            </button>
          )}
          <button onClick={onExportExcel} className={toolBtn}>
            <Download className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
            Export
          </button>
          {userRole === 'admin' && (
            <button
              onClick={onOpenAddProduct}
              className="h-9 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold flex items-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add product
            </button>
          )}
        </div>
      </div>

      {/* Search (phones; the top bar has it on larger screens) */}
      <label className="relative block md:hidden">
        <span className="sr-only">Search</span>
        <Search className="w-[18px] h-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
        <input
          type="search"
          placeholder="Name, brand, SKU or rack"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-900 border border-slate-800 text-[15px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </label>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={chip(selectedCategory === cat)}>
              {cat === 'ALL' ? 'All categories' : cat}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            aria-label="Brand"
            className="h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
          >
            {brands.map((b) => (
              <option key={b} value={b}>{b === 'ALL' ? 'All brands' : b}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-800 bg-slate-950">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setStockStatusFilter(f.id)}
                className={`h-7 px-2.5 rounded-md text-sm transition-colors ${
                  stockStatusFilter === f.id ? 'bg-slate-850 text-slate-100' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product rows: photo first, then name, then stock */}
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {filteredProducts.map((product) => {
          const state = stockState(product);
          return (
            <li key={product.id}>
              <div
                onClick={() => onSelectProduct(product)}
                className="h-full flex items-center gap-3 sm:gap-4 p-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 cursor-pointer transition-colors"
              >
                <ProductThumb src={product.image_url} alt={product.name} size={72} className="rounded-xl" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500 truncate">{product.brand}</p>
                  <h3 className="text-[15px] leading-snug text-slate-100 line-clamp-2">{product.name}</h3>
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-500">
                    {product.rack && <span className="rack-tag">{product.rack}</span>}
                    <span className="truncate font-mono text-xs">{product.sku}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className={`text-[22px] leading-none font-semibold ${stockTextClass[state]}`}>
                    {formatQty(product.current_stock)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{product.unit}</p>
                  {state === 'ok' ? (
                    <p className="mt-1.5 text-xs text-slate-400">{formatPrice(product.selling_price)}</p>
                  ) : (
                    <p className={`mt-1.5 flex items-center justify-end gap-1.5 text-xs ${stockTextClass[state]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stockDotClass[state]}`} />
                      {stockLabel[state]}
                    </p>
                  )}
                </div>

                {(
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStockIn(product);
                      }}
                      title="Stock in"
                      className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center transition-colors"
                    >
                      <ArrowDownToLine className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStockOut(product);
                      }}
                      title="Stock out"
                      disabled={state === 'out'}
                      className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ArrowUpFromLine className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {filteredProducts.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
          <p className="text-base text-slate-200">No products match</p>
          <p className="mt-1 text-sm text-slate-500">Try another word, or clear the filters</p>
          {userRole === 'admin' && (
            <button
              onClick={onOpenAddProduct}
              className="mt-5 h-9 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add product
            </button>
          )}
        </div>
      )}
    </div>
  );
};
