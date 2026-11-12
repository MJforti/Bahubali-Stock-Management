import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, UserRound, Plus, X, Check, QrCode, ClipboardPaste, ArrowLeft, Copy, Share2 } from 'lucide-react';
import { logActivity } from '../../lib/activity';
import {
  addStaffName,
  cleanName,
  decodeShared,
  describeImport,
  getStaffNames,
  mergeRoster,
  removeStaffName,
  shareLink as buildShareLink,
  encodeRoster,
  createShortCode,
  fetchShortCode,
  formatShortCode,
  normalizeShortCode
} from '../../lib/staffNames';

interface NamePickerProps {
  notice?: string | null;
  current: string | null;
  canClose: boolean;
  onPick: (name: string) => void;
  onClose: () => void;
  /** Called after names are removed (here or by an import), so the app can react if the current person was removed */
  onListChanged: (names: string[]) => void;
}

/** "Who's using the app?" Every stock movement is recorded under the chosen name. */
export const NamePicker: React.FC<NamePickerProps> = ({ notice, current, canClose, onPick, onClose, onListChanged }) => {
  const [names, setNames] = useState<string[]>(() => getStaffNames());
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'share' | 'import'>('list');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [updateNote, setUpdateNote] = useState<string | null>(notice ?? null);

  // Shared even when the list is empty, so a removal of the last name can spread too
  const link = view === 'share' ? buildShareLink() : '';
  const code = view === 'share' ? encodeRoster() : '';
  const [codeCopied, setCodeCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      setCodeCopied(false);
    }
  };

  useEffect(() => {
    if (view !== 'share' || !link) return;
    QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: '#111112', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [view, link]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const shareLink = async () => {
    try {
      await navigator.share({ title: 'Bahubali staff names', text: 'Open to add our staff names to the stock app', url: link });
    } catch {
      /* cancelled */
    }
  };

  // Short code: made automatically when the share screen opens (needs internet)
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [shortErr, setShortErr] = useState<string | null>(null);
  const [shortBusy, setShortBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const makeShortCode = async () => {
    setShortBusy(true);
    setShortErr(null);
    try {
      setShortCode(await createShortCode());
    } catch (err: any) {
      setShortErr(err?.message || 'Could not make a short code right now');
    } finally {
      setShortBusy(false);
    }
  };

  useEffect(() => {
    if (view === 'share') makeShortCode();
    else setShortCode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const importPasted = async (e: React.FormEvent) => {
    e.preventDefault();
    let incoming = decodeShared(pasted);
    const short = incoming ? null : normalizeShortCode(pasted);
    if (short) {
      setImportBusy(true);
      try {
        incoming = await fetchShortCode(short);
      } catch (err: any) {
        setImportMsg(err?.message || 'Could not look up that code');
        return;
      } finally {
        setImportBusy(false);
      }
    }
    if (!incoming) {
      setImportMsg('That is not a name list code. Short codes are 6 letters and numbers');
      return;
    }
    const result = mergeRoster(incoming);
    if (result.added.length || result.removed.length) {
      logActivity('people.list_received', 'Updated the staff list from another phone', { details: [describeImport(result)] });
    }
    const next = getStaffNames();
    setNames(next);
    setPasted('');
    setImportMsg(null);
    setView('list');
    setUpdateNote(describeImport(result));
    onListChanged(next);
  };

  const addName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = cleanName(draft);
    if (!name) return;
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError(`${name} is already on the list`);
      return;
    }
    addStaffName(name);
    setNames(getStaffNames());
    logActivity('people.added', `Added ${name} to the staff list`);
    onPick(name);
  };

  const removeName = (name: string) => {
    removeStaffName(name);
    logActivity('people.removed', `Removed ${name} from the staff list`);
    const next = getStaffNames();
    setNames(next);
    onListChanged(next);
  };

  const showForm = names.length === 0 || draft !== '' || error !== null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Who's using the app?</h2>
            <p className="mt-1 text-sm text-slate-500">Stock ins and stock outs are recorded under your name</p>
            {updateNote && view === 'list' && <p className="mt-2 text-sm text-emerald-400">{updateNote}</p>}
          </div>
          {canClose && (
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {view === 'share' && (
          <div className="px-5 pb-5 space-y-4">
            <button onClick={() => setView('list')} className="h-8 -ml-1 px-1 text-sm text-slate-400 hover:text-slate-100 flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back
            </button>
            <p className="text-sm text-slate-400">
              On the other phone, open Get from another phone and enter this code
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-5 text-center">
              {shortCode ? (
                <>
                  <p className="font-mono text-[36px] leading-none font-semibold tracking-[0.12em] text-slate-100 select-all" aria-label={shortCode.split('').join(' ')}>
                    {formatShortCode(shortCode)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">Works for 7 days. Both phones need internet</p>
                </>
              ) : shortBusy ? (
                <p className="h-[52px] flex items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Making a short code
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">{shortErr}</p>
                  <button onClick={makeShortCode} className="h-9 px-3 rounded-lg border border-slate-800 text-sm text-slate-200 hover:bg-slate-850 transition-colors">
                    Try again
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">No internet? Scan the QR code with the other phone's camera, or use the long code</p>
            <div className="mx-auto w-56 h-56 rounded-xl bg-white p-2 flex items-center justify-center">
              {qr ? <img src={qr} alt="Name list QR code" className="w-full h-full" /> : <QrCode className="w-10 h-10 text-slate-400" />}
            </div>
            <p className="text-center text-sm text-slate-500">{names.length ? `${names.length} names: ${names.join(', ')}` : 'No names. Sharing this clears the list on the other phone'}</p>
            <p className="text-center text-xs text-slate-500">Names you removed on this phone get removed on the other phone too</p>
            <details>
              <summary className="cursor-pointer list-none text-sm text-slate-400 hover:text-slate-100">Show long code (works offline)</summary>
              <div className="mt-2 flex items-center justify-end">
                <button onClick={copyCode} className="h-8 px-2 -mr-2 rounded-lg text-sm text-slate-300 hover:bg-slate-850 flex items-center gap-1.5 transition-colors">
                  {codeCopied ? <Check className="w-4 h-4 text-emerald-400" strokeWidth={1.5} /> : <Copy className="w-4 h-4 text-slate-500" strokeWidth={1.5} />}
                  {codeCopied ? 'Copied' : 'Copy long code'}
                </button>
              </div>
              <p className="mt-1 max-h-24 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100 break-all select-all">
                {code}
              </p>
            </details>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copyLink} className="h-11 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-100 text-[15px] flex items-center justify-center gap-2 transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-400" strokeWidth={1.5} /> : <Copy className="w-4 h-4 text-slate-400" strokeWidth={1.5} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {'share' in navigator ? (
                <button onClick={shareLink} className="h-11 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-100 text-[15px] flex items-center justify-center gap-2 transition-colors">
                  <Share2 className="w-4 h-4 text-slate-400" strokeWidth={1.5} /> Send
                </button>
              ) : <span />}
            </div>
          </div>
        )}

        {view === 'import' && (
          <form onSubmit={importPasted} className="px-5 pb-5 space-y-3">
            <button type="button" onClick={() => setView('list')} className="h-8 -ml-1 px-1 text-sm text-slate-400 hover:text-slate-100 flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back
            </button>
            <p className="text-sm text-slate-400">
              On the phone that has the list, open the name picker and choose Share list. Type the 6-character code shown there, or paste a long code
            </p>
            <textarea
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setImportMsg(null);
              }}
              rows={3}
              autoFocus
              placeholder="Short code, e.g. K7Q M2X"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 resize-none"
            />
            {importMsg && <p className="text-sm text-rose-400">{importMsg}</p>}
            <button
              type="submit"
              disabled={!pasted.trim() || importBusy}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[15px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {importBusy ? 'Looking up code' : 'Add these names'}
            </button>
          </form>
        )}

        {view === 'list' && (
          <>
        {names.length > 0 && (
          <ul className="px-3 max-h-[50vh] overflow-y-auto">
            {names.map((name) => (
              <li key={name} className="flex items-center gap-1">
                <button
                  onClick={() => (editing ? undefined : onPick(name))}
                  disabled={editing}
                  className={`flex-1 h-12 px-3 rounded-xl flex items-center gap-3 text-left text-[15px] transition-colors ${
                    name === current ? 'bg-slate-850 text-slate-100' : 'text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <span className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 text-sm flex items-center justify-center">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{name}</span>
                  {name === current && !editing && <Check className="w-4 h-4 text-slate-400" strokeWidth={1.5} />}
                </button>
                {editing && (
                  <button
                    onClick={() => removeName(name)}
                    aria-label={`Remove ${name}`}
                    className="w-10 h-10 rounded-lg text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addName} className="p-5 pt-3 space-y-2">
          <label className="block">
            <span className="sr-only">Your name</span>
            <div className="relative">
              <UserRound className="w-[18px] h-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                placeholder={names.length ? 'Someone new? Type their name' : 'Your name'}
                autoFocus={names.length === 0}
                maxLength={40}
                className="w-full h-12 pl-10 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
              />
            </div>
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {showForm && (
            <button
              type="submit"
              disabled={!cleanName(draft)}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add and continue
            </button>
          )}
          {names.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="w-full h-9 text-sm text-slate-500 hover:text-slate-200 transition-colors"
            >
              {editing ? 'Done' : 'Remove a name'}
            </button>
          )}
        </form>
          <div className="px-5 pb-5 -mt-1 grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
            <button
              onClick={() => setView('share')}
              className="h-10 rounded-lg text-sm text-slate-300 hover:bg-slate-850 flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
            >
              <QrCode className="w-4 h-4 text-slate-500" strokeWidth={1.5} /> Share list
            </button>
            <button
              onClick={() => setView('import')}
              className="h-10 rounded-lg text-sm text-slate-300 hover:bg-slate-850 flex items-center justify-center gap-2 transition-colors"
            >
              <ClipboardPaste className="w-4 h-4 text-slate-500" strokeWidth={1.5} /> Get from another phone
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
