import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Product, ExcelColumnMapping } from '../../types/inventory';
import { parseExcelFile, autoMapColumns, validateImportRows } from '../../services/excelService';

interface ExcelImportModalProps {
  existingProducts: Product[];
  onClose: () => void;
  onImportConfirmed: (products: Partial<Product>[]) => Promise<void>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  existingProducts,
  onClose,
  onImportConfirmed
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ExcelColumnMapping>({
    name: '',
    brand: '',
    category: '',
    sku: '',
    stock: '',
    unit: '',
    min_stock: '',
    purchase_price: '',
    selling_price: '',
    supplier: '',
    rack: ''
  });

  const [validatedProducts, setValidatedProducts] = useState<Partial<Product>[]>([]);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setError(null);

    try {
      const parsed = await parseExcelFile(selectedFile);
      if (parsed.headers.length === 0) {
        throw new Error('Selected spreadsheet is empty or missing headers.');
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);

      // Auto map columns
      const autoMap = autoMapColumns(parsed.headers);
      setMapping(autoMap);
      setStep('mapping');
    } catch (err: any) {
      setError(err.message || 'Failed to read Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunValidation = () => {
    if (!mapping.name) {
      setError('Product Name column mapping is required.');
      return;
    }

    const existingSkus = new Set(existingProducts.map((p) => p.sku));
    const result = validateImportRows(rows, mapping, existingSkus);

    setValidatedProducts(result.validProducts);
    setValidationErrors(result.errors);
    setStep('preview');
  };

  const handleConfirmImport = async () => {
    if (validatedProducts.length === 0) {
      setError('No valid product rows to import.');
      return;
    }

    setLoading(true);
    try {
      await onImportConfirmed(validatedProducts);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-extrabold text-slate-100">
              Import Excel / CSV Stock Sheet
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          
          {error && (
            <div className="p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-3xl p-10 text-center space-y-3 bg-slate-950 transition-colors cursor-pointer"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx, .xls, .csv';
                  input.onchange = (e: any) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    Click to browse or drag & drop Excel sheet
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports .xlsx, .xls, and .csv files
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-300">Map Excel Columns to Database Fields</span>
                <span className="text-[11px] text-slate-500">{rows.length} Rows Found</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {Object.keys(mapping).map((fieldKey) => (
                  <div key={fieldKey} className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">
                      {fieldKey.replace('_', ' ')} {fieldKey === 'name' ? '*' : ''}
                    </label>
                    <select
                      value={(mapping as any)[fieldKey]}
                      onChange={(e) => setMapping((m) => ({ ...m, [fieldKey]: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Do Not Import --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleRunValidation}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg hover:bg-amber-400"
                >
                  <span>Validate & Preview</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Confirm */}
          {step === 'preview' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="font-bold text-emerald-400 text-sm">{validatedProducts.length} Valid Products Ready</span>
                  {validationErrors.length > 0 && (
                    <p className="text-rose-400 font-semibold mt-0.5">{validationErrors.length} Errors Skipped</p>
                  )}
                </div>
              </div>

              {/* Preview Grid */}
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Brand</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2 text-right">Stock</th>
                      <th className="p-2">Rack</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {validatedProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-850">
                        <td className="p-2 font-bold text-slate-100">{p.name}</td>
                        <td className="p-2 text-amber-400 font-semibold">{p.brand}</td>
                        <td className="p-2 font-mono text-slate-400">{p.sku}</td>
                        <td className="p-2 text-right font-black text-emerald-400">{p.current_stock} {p.unit}</td>
                        <td className="p-2 uppercase font-bold text-slate-300">{p.rack || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirm Import */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl"
                >
                  Back to Mapping
                </button>

                <button
                  type="button"
                  disabled={loading || validatedProducts.length === 0}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing Rows...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>CONFIRM IMPORT ({validatedProducts.length} ITEMS)</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
