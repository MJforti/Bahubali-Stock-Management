import React from 'react';
import { AlertTriangle, Send, Trash2, ShieldAlert } from 'lucide-react';
import { ProductDraft } from '../../services/draftService';

interface UnsavedDraftsWarningModalProps {
  isOpen: boolean;
  drafts: ProductDraft[];
  onKeepDraft: () => void;
  onPublishNow: () => void;
  onDiscardAndExit: () => void;
}

export const UnsavedDraftsWarningModal: React.FC<UnsavedDraftsWarningModalProps> = ({
  isOpen,
  drafts,
  onKeepDraft,
  onPublishNow,
  onDiscardAndExit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative text-center">
        
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-extrabold text-slate-100">Unpublished Draft Changes</h3>
          <p className="text-xs text-amber-400 font-bold">
            You have {drafts.length} unpublished {drafts.length === 1 ? 'change' : 'changes'} in Admin Mode.
          </p>
          <p className="text-xs text-slate-400 pt-1">
            Exiting Admin Mode will leave your draft stored until your next admin session. What would you like to do?
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={onPublishNow}
            className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 fill-slate-950" />
            <span>🚀 Publish Changes Now</span>
          </button>

          <button
            onClick={onKeepDraft}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded-xl transition-all"
          >
            Keep Draft & Exit to Staff View
          </button>

          <button
            onClick={onDiscardAndExit}
            className="w-full py-2.5 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard Changes & Exit</span>
          </button>
        </div>

      </div>
    </div>
  );
};
