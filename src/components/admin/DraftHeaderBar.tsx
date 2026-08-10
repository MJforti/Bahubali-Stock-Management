import React from 'react';
import { Sparkles, Send, Eye, History, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ProductDraft } from '../../services/draftService';

interface DraftHeaderBarProps {
  drafts: ProductDraft[];
  lastPublishedText?: string;
  onOpenReview: () => void;
  onOpenPublishModal: () => void;
  onOpenHistory: () => void;
  onDiscardDrafts: () => void;
  onExitAdmin: () => void;
}

export const DraftHeaderBar: React.FC<DraftHeaderBarProps> = ({
  drafts,
  lastPublishedText = '10 Aug 2026, 11:30 AM',
  onOpenReview,
  onOpenPublishModal,
  onOpenHistory,
  onDiscardDrafts,
  onExitAdmin
}) => {
  const hasDrafts = drafts.length > 0;

  return (
    <div className="bg-slate-900 border-b border-amber-500/30 text-slate-100 py-2.5 px-4 sticky top-16 z-25 backdrop-blur-md shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>ADMIN MODE</span>
          </div>

          {hasDrafts ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>🟡 {drafts.length} Unpublished {drafts.length === 1 ? 'Change' : 'Changes'}</span>
              </span>
              <span className="text-[11px] text-slate-400 hidden lg:inline">
                (Staff devices continue seeing published inventory until you publish)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>🟢 All Changes Published</span>
            </div>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          
          <button
            onClick={onOpenHistory}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl font-bold transition-all flex items-center gap-1"
            title="View Publish History Logs"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">Version History</span>
          </button>

          {hasDrafts && (
            <>
              <button
                onClick={onOpenReview}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl font-bold transition-all flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Review ({drafts.length})</span>
              </button>

              <button
                onClick={onDiscardDrafts}
                className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 rounded-xl font-bold transition-all flex items-center gap-1"
                title="Discard all unpublished draft changes"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Discard</span>
              </button>

              <button
                onClick={onOpenPublishModal}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 animate-bounce"
              >
                <Send className="w-3.5 h-3.5 fill-slate-950" />
                <span>🚀 PUBLISH CHANGES</span>
              </button>
            </>
          )}

          <button
            onClick={onExitAdmin}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl font-bold transition-colors ml-1"
          >
            Exit Admin
          </button>

        </div>

      </div>
    </div>
  );
};
