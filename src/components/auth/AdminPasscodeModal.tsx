import React, { useState } from 'react';
import { X, LockOpen } from 'lucide-react';
import { logActivity } from '../../lib/activity';
import { verifyAdminPasscode } from '../../lib/localDb';

interface AdminPasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPasscodeModal: React.FC<AdminPasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Enter the admin code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await verifyAdminPasscode(code.trim());
      if (isValid) {
        setCode('');
        setError(null);
        onSuccess();
      } else {
        logActivity('people.admin_failed', 'Entered a wrong admin code');
        setError('Wrong admin code');
      }
    } catch (err) {
      setError('Something went wrong. Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.32)] space-y-6 relative animate-in fade-in zoom-in-95">
        
        {/* Close Button */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-slate-100">Admin code</h3>
            <p className="mt-1 text-sm text-slate-500">Needed to add or edit products, correct counts, import and restore</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="sr-only">Admin code</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="••••"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              className="w-full h-14 text-center text-2xl tracking-[0.3em] bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-600"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-800 text-slate-300 text-[15px] hover:bg-slate-850 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <LockOpen className="w-4 h-4" strokeWidth={2} />
              {loading ? 'Checking' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
