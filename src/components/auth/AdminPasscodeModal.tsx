import React, { useState } from 'react';
import { ShieldCheck, Lock, X, AlertCircle } from 'lucide-react';
import { verifyAdminPasscode } from '../../lib/supabase';

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
      setError('Please enter the Admin Security Code');
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
        setError('Incorrect Admin Code. Access denied.');
      }
    } catch (err) {
      setError('Verification error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Lock className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-100">Unlock Admin Mode</h3>
          <p className="text-xs text-slate-400">
            Enter the 4-digit master admin code to enable Stock In, Stock Out, and Inventory editing.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Admin Passcode
            </label>
            <input
              type="password"
              maxLength={10}
              placeholder="Enter Admin Code (Default: 9988)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              className="w-full text-center text-2xl font-mono tracking-widest py-3 bg-slate-950 border border-slate-800 rounded-2xl text-amber-400 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-2xl transition-all"
            >
              Cancel (Stay Staff)
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Verifying...' : 'Unlock Admin'}</span>
            </button>
          </div>
        </form>

        <p className="text-[10px] text-center text-slate-500 font-mono">
          Staff users are 100% read-only.
        </p>

      </div>
    </div>
  );
};
