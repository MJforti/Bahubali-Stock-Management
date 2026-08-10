import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Upload, Loader2, Sparkles, Check } from 'lucide-react';
import { Product, UnitType } from '../../types/inventory';
import { uploadProductImage } from '../../services/imageService';
import { INITIAL_BRANDS, INITIAL_CATEGORIES } from '../../data/seedData';

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSave: (productData: Partial<Product>) => Promise<void>;
}

const UNIT_OPTIONS: UnitType[] = [
  'Piece', 'Box', 'Packet', 'Kg', 'Liter', 'Meter', 'Coil', 'Set', 'Pair', 'Bucket', 'Roll', 'Feet'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  onClose,
  onSave
}) => {
  const isEditing = Boolean(product?.id);

  const [name, setName] = useState(product?.name || '');
  const [brand, setBrand] = useState(product?.brand || 'Bosch');
  const [category, setCategory] = useState(product?.category || 'Tools & Accessories');
  const [subCategory, setSubCategory] = useState(product?.sub_category || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [description, setDescription] = useState(product?.description || '');
  const [unit, setUnit] = useState(product?.unit || 'Piece');
  const [currentStock, setCurrentStock] = useState<number>(product?.current_stock ?? 0);
  const [minimumStock, setMinimumStock] = useState<number>(product?.minimum_stock ?? 5);
  const [reorderLevel, setReorderLevel] = useState<number>(product?.reorder_level ?? 10);
  const [purchasePrice, setPurchasePrice] = useState<number>(product?.purchase_price ?? 0);
  const [sellingPrice, setSellingPrice] = useState<number>(product?.selling_price ?? 0);
  const [supplier, setSupplier] = useState(product?.supplier || '');
  const [rack, setRack] = useState(product?.rack || '');

  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(product?.image_url || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateSku = () => {
    const brandPrefix = (brand || 'GEN').substring(0, 3).toUpperCase();
    const namePrefix = (name || 'PRD').replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
    const rand = Math.floor(100 + Math.random() * 900);
    setSku(`${brandPrefix}-${namePrefix}-${rand}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }

    let finalSku = sku.trim();
    if (!finalSku) {
      finalSku = `SKU-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    setLoading(true);
    setError(null);

    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadProductImage(imageFile, finalSku);
      }

      await onSave({
        name: name.trim(),
        brand,
        category,
        sub_category: subCategory.trim(),
        sku: finalSku,
        description: description.trim(),
        unit,
        current_stock: Number(currentStock),
        minimum_stock: Number(minimumStock),
        reorder_level: Number(reorderLevel),
        purchase_price: Number(purchasePrice),
        selling_price: Number(sellingPrice),
        supplier: supplier.trim(),
        rack: rack.trim().toUpperCase(),
        image_url: finalImageUrl,
        is_active: true
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>{isEditing ? 'Edit Product Details' : 'Add New Hardware Product'}</span>
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[85vh] overflow-y-auto">
          
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Product Image Capture / Upload Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Product Photo (Visual Identification)
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              
              {/* Preview Box */}
              <div className="w-32 h-32 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center relative flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2 text-slate-600">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                    <span className="text-[10px]">No Photo</span>
                  </div>
                )}
              </div>

              {/* Mobile Camera & Gallery Buttons */}
              <div className="flex-1 space-y-2 w-full">
                <div className="grid grid-cols-2 gap-2">
                  
                  {/* Take Photo Button (Mobile Camera API) */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition-all active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>📷 Take Photo</span>
                  </button>

                  {/* Gallery Button */}
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <span>🖼️ Choose Photo</span>
                  </button>

                </div>

                <p className="text-[11px] text-slate-500">
                  Upload a clear image of the hardware item or brand logo to help shop staff identify stock visually.
                </p>

                {/* Hidden Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

            </div>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Name */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-300">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bosch 8mm Drill Bit for Concrete"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Brand */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Brand *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bosch, Asian Paints, Polycab"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {INITIAL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="Other">Other Category</option>
              </select>
            </div>

            {/* SKU */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">SKU / Item Code</label>
                <button
                  type="button"
                  onClick={handleGenerateSku}
                  className="text-[10px] text-amber-400 font-bold hover:underline"
                >
                  Generate
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. DRL-BOS-8MM"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Rack Location */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Rack / Shelf Location</label>
              <input
                type="text"
                placeholder="e.g. B-12, P-04, E-01"
                value={rack}
                onChange={(e) => setRack(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-amber-400 uppercase placeholder-slate-600 focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>

          </div>

          {/* Stock & Unit Section */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Stock & Measurement
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              {/* Unit */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Unit of Measure</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Initial Stock */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Initial Stock Qty</label>
                <input
                  type="number"
                  min="0"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-emerald-400 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Minimum Stock Level */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Minimum Stock Level</label>
                <input
                  type="number"
                  min="0"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

            </div>
          </div>

          {/* Pricing & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Purchase Price */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Purchase Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Selling Price */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Selling Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Supplier */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Supplier Name</label>
              <input
                type="text"
                placeholder="e.g. Bosch India"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Product...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
