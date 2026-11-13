import React, { useState } from 'react';
import { X, Upload, Download, Loader2, ArrowLeft } from 'lucide-react';
import { ExcelColumnMapping, Product, Store } from '../../types/inventory';
import {
  ImportProduct,
  SHEET_COLUMNS,
  ValidationError,
  autoMapColumns,
  downloadSampleSheet,
  emptyMapping,
  parseExcelFile,
  validateImportRows
} from '../../services/excelService';
import { addStore, fetchStores } from '../../lib/stores';
import { logActivity } from '../../lib/activity';
import { formatQty } from '../ui/stock';

interface ExcelImportModalProps {
  existingProducts: Product[];
  stores: Store[];
  defaultStoreId: string;
  onClose: () => void;
  onImportConfirmed: (products: Partial<Product>[]) => Promise<void>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ existingProducts, stores, defaultStoreId, onClose, onImportConfirmed }) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ExcelColumnMapping>(emptyMapping());
  const [result, setResult] = useState<{ validProducts: ImportProduct[]; errors: ValidationError[]; newStoreNames: string[]; rowCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeName = (key: string) =>
    key.startsWith('new:') ? result?.newStoreNames.find((n) => n.toLowerCase() === key.slice(4)) || key.slice(4) : stores.find((s) => s.id === key)?.name || 'Store';
  const defaultName = stores.find((s) => s.id === defaultStoreId)?.name || 'Main Store';

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.headers.length === 0) throw new Error('That sheet is empty. Fill in the sample sheet and try again');
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers));
      setStep('mapping');
    } catch (err: any) {
      setError(err?.message || 'Could not read that file');
    } finally {
      setLoading(false);
    }
  };

  const check = () => {
    if (!mapping.name) {
      setError('Pick which column has the product name');
      return;
    }
    setError(null);
    setResult(validateImportRows(rows, mapping, new Set(existingProducts.map((p) => p.sku)), stores, defaultStoreId));
    setStep('preview');
  };

  const confirm = async () => {
    if (!result || result.validProducts.length === 0) {
      setError('No rows with a product name to import');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Create the stores named in the sheet that the app doesn't have yet
      const ids: Record<string, string> = {};
      let known = await fetchStores();
      for (const name of result.newStoreNames) {
        const s = await addStore(name, known);
        await logActivity('data.store_added', `Added store ${s.name} (from Excel import)`);
        known = [...known, s];
        ids[`new:${name.toLowerCase()}`] = s.id;
      }
      const ready = result.validProducts.map((p) => ({
        ...p,
        opening_by_store: Object.fromEntries(Object.entries(p.opening_by_store).map(([k, v]) => [ids[k] || k, v]))
      }));
      await onImportConfirmed(ready);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Import failed. Please try again');
    } finally {
      setLoading(false);
    }
  };

  const select = 'h-10 w-full px-2 rounded-lg bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-slate-600';
  const secondary = 'h-11 px-4 rounded-xl border border-slate-800 text-slate-300 text-[15px] hover:bg-slate-850 transition-colors flex items-center justify-center gap-2';
  const primary = 'h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50';
  const storesInImport = result ? [...new Set(result.validProducts.flatMap((p) => Object.keys(p.opening_by_store)))] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Import from Excel</h2>
            <p className="mt-1 text-sm text-slate-500">
              {step === 'upload' ? 'Add many products at once' : step === 'mapping' ? `Match the columns in ${fileName}` : 'Check before importing'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto space-y-4">
          {error && <p className="rounded-xl border border-rose-500/30 bg-rose-950 px-4 py-3 text-sm text-rose-300">{error}</p>}

          {step === 'upload' && (
            <>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-700 hover:border-slate-500 bg-slate-950 px-6 py-10 text-center transition-colors">
                {loading ? (
                  <Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Upload className="w-6 h-6 mx-auto text-slate-400" strokeWidth={1.5} />
                )}
                <span className="mt-3 block text-[15px] text-slate-100">Choose an Excel or CSV file</span>
                <span className="mt-1 block text-sm text-slate-500">.xlsx, .xls or .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 text-sm">
                  <p className="text-slate-200">Not sure how to lay it out?</p>
                  <p className="mt-0.5 text-slate-500">The sample has the app's columns, example rows and the list of units, categories and stores</p>
                </div>
                <button onClick={() => downloadSampleSheet(stores)} className={secondary}>
                  <Download className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                  Download sample sheet
                </button>
              </div>
            </>
          )}

          {step === 'mapping' && (
            <>
              <p className="text-sm text-slate-500">
                {rows.length} rows found. Columns with the sample's names are matched already. Rows without a store go to <span className="text-slate-300">{defaultName}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {SHEET_COLUMNS.map((c) => (
                  <label key={c.key} className="block">
                    <span className="block mb-1 text-sm text-slate-400">
                      {c.header}
                      {c.key === 'name' ? ' *' : ''}
                    </span>
                    <select value={mapping[c.key]} onChange={(e) => setMapping({ ...mapping, [c.key]: e.target.value })} className={select}>
                      <option value="">Not in my sheet</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <button onClick={() => setStep('upload')} className={secondary}>
                  <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back
                </button>
                <button onClick={check} className={primary}>Check and preview</button>
              </div>
            </>
          )}

          {step === 'preview' && result && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Products', result.validProducts.length],
                  ['Rows read', result.rowCount],
                  ['Rows skipped', result.errors.length]
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl border border-slate-800 bg-slate-950 py-3">
                    <p className={`text-[22px] leading-none font-semibold ${label === 'Rows skipped' && Number(value) > 0 ? 'text-amber-400' : 'text-slate-100'}`}>{value}</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              {result.newStoreNames.length > 0 && (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  New stores will be added: <span className="text-slate-100">{result.newStoreNames.join(', ')}</span>. If a name is a typo, fix it in the sheet and import again
                </p>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-slate-950">
                  <p className="px-4 pt-3 text-sm text-amber-400">These rows will be skipped</p>
                  <ul className="px-4 py-2 max-h-36 overflow-y-auto text-sm text-slate-400 divide-y divide-slate-800">
                    {result.errors.map((e, i) => (
                      <li key={i} className="py-1.5">Row {e.rowIndex}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.validProducts.length > 0 && (
                <div className="rounded-xl border border-slate-800 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-950 text-left text-xs text-slate-500">
                        <th className="px-3 py-2 font-normal">Product</th>
                        <th className="px-3 py-2 font-normal">SKU</th>
                        {storesInImport.map((k) => (
                          <th key={k} className="px-3 py-2 font-normal text-right whitespace-nowrap">{storeName(k)}</th>
                        ))}
                        <th className="px-3 py-2 font-normal">Rack</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {result.validProducts.slice(0, 50).map((p) => (
                        <tr key={p.sku}>
                          <td className="px-3 py-2 text-slate-100">{p.name}<span className="block text-xs text-slate-500">{p.brand}</span></td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                          {storesInImport.map((k) => (
                            <td key={k} className="px-3 py-2 text-right text-slate-200">{k in p.opening_by_store ? formatQty(p.opening_by_store[k]) : <span className="text-slate-600">—</span>}</td>
                          ))}
                          <td className="px-3 py-2">{p.rack ? <span className="rack-tag">{p.rack}</span> : <span className="text-slate-600">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.validProducts.length > 50 && <p className="px-3 py-2 text-xs text-slate-500">and {result.validProducts.length - 50} more</p>}
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <button onClick={() => setStep('mapping')} className={secondary} disabled={loading}>
                  <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back
                </button>
                <button onClick={confirm} disabled={loading || result.validProducts.length === 0} className={primary}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
                  {loading ? 'Importing' : `Import ${result.validProducts.length} ${result.validProducts.length === 1 ? 'product' : 'products'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
