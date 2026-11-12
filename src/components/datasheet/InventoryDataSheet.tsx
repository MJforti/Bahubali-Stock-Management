import React, { useState } from 'react';
import { Search, Edit2, Check, X, Eye, Plus } from 'lucide-react';
import { ProductThumb } from '../ui/ProductThumb';
import { formatPrice } from '../ui/stock';
import { Product, UserRole } from '../../types/inventory';

interface InventoryDataSheetProps {
  products: Product[];
  userRole: UserRole;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  onSelectProduct: (product: Product) => void;
  onOpenAddProduct: () => void;
}

export const InventoryDataSheet: React.FC<InventoryDataSheetProps> = ({
  products,
  userRole,
  onUpdateProduct,
  onSelectProduct,
  onOpenAddProduct
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const activeProducts = products.filter((p) => p.is_active);

  const filteredProducts = activeProducts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.rack || '').toLowerCase().includes(q)
    );
  });

  const handleStartEdit = (product: Product) => {
    if (userRole !== 'admin') return;
    setEditingId(product.id);
    setEditForm({
      current_stock: product.current_stock,
      minimum_stock: product.minimum_stock,
      selling_price: product.selling_price,
      purchase_price: product.purchase_price,
      rack: product.rack
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await onUpdateProduct(id, editForm);
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-medium text-slate-100">Data sheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            {userRole === 'admin' ? 'Edit stock, prices and racks right in the table' : 'All products in one table'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
            <input
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-48 pl-9 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </label>
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

      {/* Spreadsheet Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm text-slate-300">
            
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-xs font-normal text-slate-500">
                <th className="p-3 w-12 text-center">Photo</th>
                <th className="p-3 min-w-[200px] sticky left-0 bg-slate-950 z-10 border-r border-slate-800">Product</th>
                <th className="p-3 min-w-[100px]">Brand</th>
                <th className="p-3 min-w-[130px]">Category</th>
                <th className="p-3 min-w-[110px]">SKU</th>
                <th className="p-3 min-w-[100px] text-right">Stock</th>
                <th className="p-3 min-w-[80px]">Unit</th>
                <th className="p-3 min-w-[90px] text-right">Minimum</th>
                <th className="p-3 min-w-[100px] text-right">Cost</th>
                <th className="p-3 min-w-[100px] text-right">Price</th>
                <th className="p-3 min-w-[90px] text-center">Rack</th>
                <th className="p-3 min-w-[100px] text-center"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800">
              {filteredProducts.map((p) => {
                const isEditing = editingId === p.id;
                const isLow = p.current_stock > 0 && p.current_stock <= p.minimum_stock;
                const isOut = p.current_stock === 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-850/60 transition-colors group">
                    
                    {/* Image Thumbnail */}
                    <td className="p-2 text-center">
                      <button onClick={() => p.image_url && setEnlargedImage(p.image_url)} title="Enlarge photo" className="mx-auto block">
                        <ProductThumb src={p.image_url} alt={p.name} size={36} />
                      </button>
                    </td>

                    {/* Product Name (Sticky Column) */}
                    <td className="p-3 font-medium text-slate-100 sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10 border-r border-slate-800">
                      <button
                        onClick={() => onSelectProduct(p)}
                        className="hover:text-slate-100 text-left transition-colors font-medium"
                      >
                        {p.name}
                      </button>
                    </td>

                    {/* Brand */}
                    <td className="p-3 text-slate-300">{p.brand}</td>

                    {/* Category */}
                    <td className="p-3 text-slate-400">{p.category}</td>

                    {/* SKU */}
                    <td className="p-3 font-mono text-xs text-slate-500">{p.sku}</td>

                    {/* Current Stock (Editable) */}
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.current_stock ?? p.current_stock}
                          onChange={(e) => setEditForm((f) => ({ ...f, current_stock: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 bg-slate-950 border border-slate-600 rounded font-medium text-emerald-400 text-xs"
                        />
                      ) : (
                        <span className={`font-semibold text-sm ${
                          isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-100'
                        }`}>
                          {p.current_stock}
                        </span>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="p-3 text-slate-400 font-medium">{p.unit}</td>

                    {/* Minimum Stock (Editable) */}
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.minimum_stock ?? p.minimum_stock}
                          onChange={(e) => setEditForm((f) => ({ ...f, minimum_stock: Number(e.target.value) }))}
                          className="w-16 px-2 py-1 bg-slate-950 border border-slate-600 rounded font-medium text-amber-400 text-xs"
                        />
                      ) : (
                        <span className="font-medium text-slate-300">{p.minimum_stock}</span>
                      )}
                    </td>

                    {/* Purchase Price (Editable) */}
                    <td className="p-3 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.purchase_price ?? p.purchase_price}
                          onChange={(e) => setEditForm((f) => ({ ...f, purchase_price: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 bg-slate-950 border border-slate-600 rounded text-xs text-slate-200"
                        />
                      ) : (
                        formatPrice(p.purchase_price)
                      )}
                    </td>

                    {/* Selling Price (Editable) */}
                    <td className="p-3 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.selling_price ?? p.selling_price}
                          onChange={(e) => setEditForm((f) => ({ ...f, selling_price: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 bg-slate-950 border border-slate-600 rounded font-medium text-amber-400 text-xs"
                        />
                      ) : (
                        <span className="text-slate-100">{formatPrice(p.selling_price)}</span>
                      )}
                    </td>

                    {/* Rack (Editable) */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.rack ?? p.rack}
                          onChange={(e) => setEditForm((f) => ({ ...f, rack: e.target.value.toUpperCase() }))}
                          className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-600 rounded text-xs font-medium text-amber-300"
                        />
                      ) : (
                        p.rack ? <span className="rack-tag">{p.rack}</span> : <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(p.id)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-950 hover:bg-white flex items-center justify-center"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-8 h-8 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleStartEdit(p)}
                            className="w-8 h-8 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-850 flex items-center justify-center transition-colors"
                            title="Edit row"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectProduct(p)}
                            className="w-8 h-8 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-850 flex items-center justify-center transition-colors"
                            title="Open product"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      </div>

      {/* Enlarged Image Popover */}
      {enlargedImage && (
        <div
          onClick={() => setEnlargedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer"
        >
          <div className="relative max-w-lg max-h-[80vh] rounded-2xl bg-slate-900 border border-slate-800 p-2 overflow-hidden shadow-2xl">
            <img src={enlargedImage} alt="Product Photo" className="w-full h-full object-contain max-h-[75vh]" />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-950 text-slate-100 border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
