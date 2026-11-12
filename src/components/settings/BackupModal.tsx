import React, { useRef, useState } from 'react';
import { X, Send, FileDown, Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { exportBackup, restoreBackup, notifyOtherTabs } from '../../lib/localDb';
import { logActivity } from '../../lib/activity';
import { buildSyncFile, describeSync, isSyncFile, mergeSyncFile } from '../../lib/stockSync';

interface BackupModalProps {
  isAdmin: boolean;
  staffName: string | null;
  onClose: () => void;
  onRestored: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const counts = (d: { products: unknown[]; stock_transactions: unknown[] }, sep = ' and ') =>
  `${plural(d.products.length, 'product', 'products')}${sep}${plural(d.stock_transactions.length, 'movement', 'movements')}`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const BackupModal: React.FC<BackupModalProps> = ({ isAdmin, staffName, onClose, onRestored }) => {
  const receiveRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'send' | 'receive' | 'backup' | 'restore'>(null);
  const [message, setMessage] = useState<{ ok: boolean; lines: string[] } | null>(null);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<string[]>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage({ ok: true, lines: await fn() });
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // share sheet closed
      setMessage({ ok: false, lines: [err?.message || 'Something went wrong. Please try again.'] });
    } finally {
      setBusy(null);
    }
  };

  const sendStock = () =>
    run('send', async () => {
      const data = await buildSyncFile(staffName);
      const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, ''); // e.g. 202611121737
      const name = `bahubali-stock-${staffName ? slug(staffName) + '-' : ''}${stamp}.json`;
      const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
      const summary = counts(data);
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Bahubali stock', text: 'Open in the Bahubali stock app: Share and backup, Get stock from another phone' });
          await logActivity('data.sent', 'Sent stock to another phone', { details: [summary] });
          return [`Sent ${summary}`];
        } catch (err: any) {
          // Closing the share menu is not an error. Anything else (e.g. desktop Chrome
          // refusing .json files with "Permission denied") falls back to saving the file.
          if (err?.name === 'AbortError') throw err;
        }
      }
      saveFile(file);
      await logActivity('data.sent', 'Saved a stock file to send to another phone', { details: [summary] });
      return [`Saved ${summary} as ${name}`, 'Send this file to the other phone, for example on WhatsApp'];
    });

  const receiveStock = (file: File) =>
    run('receive', async () => {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('Could not read that file. Pick the stock file sent from the other phone');
      }
      if (!isSyncFile(data)) {
        throw new Error((data as any)?.app === 'bahubali-stock-management' ? 'That is a full backup, not a stock file. Use Restore from backup instead' : 'That is not a stock file from this app');
      }
      const result = await mergeSyncFile(data);
      onRestored();
      const lines = describeSync(result);
      await logActivity('data.received', data.from ? `Merged stock from ${data.from}'s phone` : 'Merged stock from another phone', {
        details: describeSync(result)
      });
      if (data.from) lines.unshift(`Merged stock from ${data.from}'s phone`);
      if (result.negative.length) lines.push(`Below zero after merging, please recount: ${result.negative.join(', ')}`);
      return lines;
    });

  const downloadBackup = () =>
    run('backup', async () => {
      const data = await exportBackup();
      saveFile(new File([JSON.stringify(data)], `bahubali-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }));
      await logActivity('data.backup', 'Downloaded a backup', { details: [counts(data, ', ')] });
      return [`Backup saved: ${counts(data, ', ')}`];
    });

  const restore = (file: File) => {
    if (!window.confirm('Restoring replaces ALL products and stock history on this phone with the backup. Continue?')) return;
    run('restore', async () => {
      const data = JSON.parse(await file.text());
      await restoreBackup(data);
      await logActivity('data.restored', 'Restored everything from a backup', { details: [counts(data, ', ')] });
      notifyOtherTabs({ kind: 'reload' });
      onRestored();
      return [`Restored ${counts(data)}`];
    });
  };

  const rowBtn =
    'w-full min-h-12 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-left flex items-center gap-3 transition-colors disabled:opacity-50';
  const spinner = <Loader2 className="w-[18px] h-[18px] text-slate-400 animate-spin" strokeWidth={1.5} />;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-start justify-between gap-3 p-5 pb-2">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Share and backup</h2>
            <p className="mt-1 text-sm text-slate-500">Stock is kept on each phone. Share it to bring phones up to date</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <section className="px-5 pt-3 space-y-2">
          <h3 className="text-sm text-slate-400">With another phone</h3>
          <button onClick={sendStock} disabled={!!busy} className={rowBtn}>
            {busy === 'send' ? spinner : <Send className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />}
            <span>
              <span className="block text-[15px] text-slate-100">Send stock to another phone</span>
              <span className="block text-sm text-slate-500">Products, movements and staff names as one file</span>
            </span>
          </button>
          <button onClick={() => receiveRef.current?.click()} disabled={!!busy} className={rowBtn}>
            {busy === 'receive' ? spinner : <FileDown className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />}
            <span>
              <span className="block text-[15px] text-slate-100">Get stock from another phone</span>
              <span className="block text-sm text-slate-500">Open the file it sent. Both phones' movements are kept</span>
            </span>
          </button>
          <input
            ref={receiveRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) receiveStock(f);
            }}
          />
          <p className="text-xs text-slate-500 leading-relaxed">
            To keep two phones the same, share both ways: A sends to B, then B sends back to A
          </p>
        </section>

        {message && (
          <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 text-sm space-y-1 ${message.ok ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-rose-500/30 bg-rose-950 text-rose-300'}`}>
            {message.lines.map((l) => (
              <p key={l} className={l.startsWith('Below zero') ? 'text-amber-400' : undefined}>{l}</p>
            ))}
          </div>
        )}

        <section className="p-5 space-y-2">
          <h3 className="text-sm text-slate-400">Backup</h3>
          <div className="flex gap-2 items-start text-sm text-slate-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" strokeWidth={1.5} />
            <span>Clearing browser data deletes the stock on this phone. Download a backup regularly</span>
          </div>
          <button onClick={downloadBackup} disabled={!!busy} className={rowBtn}>
            {busy === 'backup' ? spinner : <Download className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />}
            <span className="text-[15px] text-slate-100">Download backup</span>
          </button>
          {isAdmin ? (
            <>
              <button onClick={() => restoreRef.current?.click()} disabled={!!busy} className={rowBtn}>
                {busy === 'restore' ? spinner : <Upload className="w-[18px] h-[18px] text-slate-400" strokeWidth={1.5} />}
                <span>
                  <span className="block text-[15px] text-slate-100">Restore from backup</span>
                  <span className="block text-sm text-slate-500">Replaces everything on this phone</span>
                </span>
              </button>
              <input
                ref={restoreRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) restore(f);
                }}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">Restoring a backup needs the admin code</p>
          )}
        </section>
      </div>
    </div>
  );
};
