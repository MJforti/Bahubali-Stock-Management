import React, { useState } from 'react';
import { UserRound, Plus, X, Check } from 'lucide-react';
import { cleanName, getStaffNames, saveStaffNames } from '../../lib/staffNames';

interface NamePickerProps {
  current: string | null;
  canClose: boolean;
  onPick: (name: string) => void;
  onClose: () => void;
}

/** "Who's using the app?" Every stock movement is recorded under the chosen name. */
export const NamePicker: React.FC<NamePickerProps> = ({ current, canClose, onPick, onClose }) => {
  const [names, setNames] = useState<string[]>(() => getStaffNames());
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = cleanName(draft);
    if (!name) return;
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError(`${name} is already on the list`);
      return;
    }
    const next = [...names, name].sort((a, b) => a.localeCompare(b));
    setNames(next);
    saveStaffNames(next);
    onPick(name);
  };

  const removeName = (name: string) => {
    const next = names.filter((n) => n !== name);
    setNames(next);
    saveStaffNames(next);
  };

  const showForm = names.length === 0 || draft !== '' || error !== null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Who's using the app?</h2>
            <p className="mt-1 text-sm text-slate-500">Stock ins and stock outs are recorded under your name</p>
          </div>
          {canClose && (
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

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
      </div>
    </div>
  );
};
