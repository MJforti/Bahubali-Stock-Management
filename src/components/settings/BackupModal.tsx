import React, { useRef, useState } from 'react';
import { X, HardDrive, Download, Upload, AlertTriangle } from 'lucide-react';
import { exportBackup, restoreBackup, notifyOtherTabs } from '../../lib/localDb';

interface BackupModalProps {
  isAdmin: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isAdmin, onClose, onRestored }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleDownload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bahubali-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: `Backup saved: ${data.products.length} products, ${data.stock_transactions.length} history entries.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (file: File) => {
    if (!window.confirm('Restoring replaces ALL products and stock history on this device with the backup. Continue?')) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = JSON.parse(await file.text());
      await restoreBackup(data);
      notifyOtherTabs({ kind: 'reload' });
      onRestored();
      setMessage({ ok: true, text: `Restored ${data.products.length} products and ${data.stock_transactions.length} history entries.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Could not read that backup file.' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-slate-500" />
            Offline Data & Backup
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 border border-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <p className="text-slate-400 text-xs leading-relaxed">
            All products, photos and stock history are stored only in this browser on this device. Nothing is sent to the internet.
          </p>
          <div className="flex gap-2 items-start text-xs text-amber-300 bg-slate-850 border border-slate-800 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Clearing browser data or uninstalling the browser deletes the inventory. Download a backup regularly.</span>
          </div>

          <button
            onClick={handleDownload}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Download Backup
          </button>

          {isAdmin ? (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-medium hover:border-slate-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" /> Restore from Backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleRestore(e.target.files[0])}
              />
            </>
          ) : (
            <p className="text-xs text-slate-500 text-center">Unlock Admin to restore a backup.</p>
          )}

          {message && (
            <p className={`text-xs font-semibold ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>
          )}
        </div>
      </div>
    </div>
  );
};
