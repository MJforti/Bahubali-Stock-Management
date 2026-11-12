import React, { useRef, useState } from 'react';
import { X, Download, Upload, Loader2, Cloud } from 'lucide-react';
import { exportBackup, restoreBackup, notifyOtherTabs } from '../../lib/localDb';
import { logActivity } from '../../lib/activity';
import { resendEverything, SyncStatus } from '../../lib/sync';

interface BackupModalProps {
  isAdmin: boolean;
  syncStatus: SyncStatus;
  onClose: () => void;
  onRestored: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const counts = (d: { products: unknown[]; stock_transactions: unknown[] }, sep = ' and ') =>
  `${plural(d.products.length, 'product', 'products')}${sep}${plural(d.stock_transactions.length, 'movement', 'movements')}`;

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const BackupModal: React.FC<BackupModalProps> = ({ isAdmin, syncStatus, onClose, onRestored }) => {
  const restoreRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'backup' | 'restore'>(null);
  const [message, setMessage] = useState<{ ok: boolean; lines: string[] } | null>(null);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<string[]>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage({ ok: true, lines: await fn() });
    } catch (err: any) {
      setMessage({ ok: false, lines: [err?.message || 'Something went wrong. Please try again.'] });
    } finally {
      setBusy(null);
    }
  };

  const downloadBackup = () =>
    run('backup', async () => {
      const data = await exportBackup();
      saveFile(new File([JSON.stringify(data)], `bahubali-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }));
      await logActivity('data.backup', 'Downloaded a backup', { details: [counts(data, ', ')] });
      return [`Backup saved: ${counts(data, ', ')}`];
    });

  const restore = (file: File) => {
    if (!window.confirm('Restore this backup? Its products and movements are added back and merged with the shared stock. Nothing on other phones is deleted.')) return;
    run('restore', async () => {
      let data: any;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('Could not read that file. Pick a backup downloaded from this app');
      }
      await restoreBackup(data);
      await logActivity('data.restored', 'Restored from a backup', { details: [counts(data, ', ')] });
      notifyOtherTabs({ kind: 'reload' });
      await resendEverything();
      onRestored();
      return [`Restored ${counts(data)}`, 'They are being merged into the shared stock'];
    });
  };

  const rowBtn =
    'w-full min-h-12 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-left flex items-center gap-3 transition-colors disabled:opacity-50';
  const spinner = <Loader2 className="w-[18px] h-[18px] text-slate-400 animate-spin" strokeWidth={1.5} />;
  const lastSync = syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-start justify-between gap-3 p-5 pb-2">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Backup</h2>
            <p className="mt-1 text-sm text-slate-500">Stock is shared live between phones through the central database</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mx-5 mt-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-start gap-3">
          <Cloud className="w-[18px] h-[18px] mt-0.5 text-slate-500" strokeWidth={1.5} />
          <div className="text-sm">
            <p className="text-slate-200">
              {syncStatus.state === 'offline'
                ? 'Offline'
                : syncStatus.state === 'error'
                ? 'Sync problem'
                : syncStatus.pending
                ? 'Sending changes'
                : 'Up to date'}
            </p>
            <p className="mt-0.5 text-slate-500">
              {syncStatus.state === 'offline'
                ? syncStatus.pending
                  ? `${plural(syncStatus.pending, 'change is', 'changes are')} saved on this phone and will be sent when it's back online`
                  : 'Changes are saved on this phone and sent when it is back online'
                : syncStatus.state === 'error'
                ? syncStatus.error
                : lastSync
                ? `Last synced at ${lastSync}`
                : 'Connecting'}
            </p>
          </div>
        </div>

        {message && (
          <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 text-sm space-y-1 ${message.ok ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-rose-500/30 bg-rose-950 text-rose-300'}`}>
            {message.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        )}

        <section className="p-5 space-y-2">
          <p className="text-sm text-slate-500">A backup file is an extra copy you keep yourself, for example on a computer</p>
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
                  <span className="block text-sm text-slate-500">Adds the backup back into the shared stock</span>
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
