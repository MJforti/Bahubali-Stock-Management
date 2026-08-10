import React, { useState } from 'react';
import { Table, Search, Edit2, Check, X, MapPin, Eye, Plus, AlertTriangle, Layers } from 'lucide-react';
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
      alert('Failed to update product cell.');
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Table className="w-5 h-5 text-amber-400" />
            <span>Interactive Inventory Data Sheet</span>
          </h2>
          <p className="text-xs text-slate-400">
            Spreadsheet-style data grid with inline quick editing and thumbnail previews
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={onOpenAddProduct}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-400"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-300">
            
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-3 w-12 text-center">Photo</th>
                <th className="p-3 min-w-[200px] sticky left-0 bg-slate-950 z-10 border-r border-slate-800">Product Name</th>
                <th className="p-3 min-w-[100px]">Brand</th>
                <th className="p-3 min-w-[130px]">Category</th>
                <th className="p-3 min-w-[110px]">SKU</th>
                <th className="p-3 min-w-[100px] text-right">Current Stock</th>
                <th className="p-3 min-w-[80px]">Unit</th>
                <th className="p-3 min-w-[90px] text-right">Min Stock</th>
                <th className="p-3 min-w-[100px] text-right">Purchase (₹)</th>
                <th className="p-3 min-w-[100px] text-right">Selling (₹)</th>
                <th className="p-3 min-w-[90px] text-center">Rack</th>
                <th className="p-3 min-w-[100px] text-center">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-850">
              {filteredProducts.map((p) => {
                const isEditing = editingId === p.id;
                const isLow = p.current_stock > 0 && p.current_stock <= p.minimum_stock;
                const isOut = p.current_stock === 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-850/60 transition-colors group">
                    
                    {/* Image Thumbnail */}
                    <td className="p-2 text-center">
                      <div
                        onClick={() => p.image_url && setEnlargedImage(p.image_url)}
                        className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden mx-auto flex items-center justify-center cursor-pointer hover:border-amber-500 transition-colors"
                        title="Click to enlarge photo"
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-slate-600">No img</span>
                        )}
                      </div>
                    </td>

                    {/* Product Name (Sticky Column) */}
                    <td className="p-3 font-bold text-slate-100 sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10 border-r border-slate-800">
                      <button
                        onClick={() => onSelectProduct(p)}
                        className="hover:text-amber-400 text-left transition-colors font-bold"
                      >
                        {p.name}
                      </button>
                    </td>

                    {/* Brand */}
                    <td className="p-3 font-bold text-amber-400">{p.brand}</td>

                    {/* Category */}
                    <td className="p-3 text-slate-400">{p.category}</td>

                    {/* SKU */}
                    <td className="p-3 font-mono text-slate-400">{p.sku}</td>

                    {/* Current Stock (Editable) */}
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.current_stock ?? p.current_stock}
                          onChange={(e) => setEditForm((f) => ({ ...f, current_stock: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right font-bold text-emerald-400 text-xs"
                        />
                      ) : (
                        <span className={`font-black text-sm ${
                          isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
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
                          className="w-16 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right font-bold text-amber-400 text-xs"
                        />
                      ) : (
                        <span className="font-bold text-slate-300">{p.minimum_stock}</span>
                      )}
                    </td>

                    {/* Purchase Price (Editable) */}
                    <td className="p-3 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.purchase_price ?? p.purchase_price}
                          onChange={(e) => setEditForm((f) => ({ ...f, purchase_price: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right text-xs text-slate-200"
                        />
                      ) : (
                        `₹${p.purchase_price || 0}`
                      )}
                    </td>

                    {/* Selling Price (Editable) */}
                    <td className="p-3 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.selling_price ?? p.selling_price}
                          onChange={(e) => setEditForm((f) => ({ ...f, selling_price: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right font-bold text-amber-400 text-xs"
                        />
                      ) : (
                        <span className="font-bold text-amber-400">₹{p.selling_price || 0}</span>
                      )}
                    </td>

                    {/* Rack (Editable) */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.rack ?? p.rack}
                          onChange={(e) => setEditForm((f) => ({ ...f, rack: e.target.value.toUpperCase() }))}
                          className="w-16 px-1.5 py-1 bg-slate-950 border border-amber-500 rounded text-center text-xs font-bold text-amber-300 uppercase"
                        />
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-amber-300 font-bold rounded text-[10px]">
                          {p.rack || '—'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(p.id)}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                            title="Save Row"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleStartEdit(p)}
                            className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700 transition-colors"
                            title="Quick Edit Cell"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectProduct(p)}
                            className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-slate-700 transition-colors"
                            title="View Full Specs"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 cursor-pointer"
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
