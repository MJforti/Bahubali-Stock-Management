import React, { useState } from 'react';
import { Send, X, AlertTriangle, CheckCircle2, Package, Layers } from 'lucide-react';
import { ProductDraft } from '../../services/draftService';

interface PublishReviewModalProps {
  isOpen: boolean;
  drafts: ProductDraft[];
  onClose: () => void;
  onConfirmPublish: (note: string) => Promise<void>;
}

export const PublishReviewModal: React.FC<PublishReviewModalProps> = ({
  isOpen,
  drafts,
  onClose,
  onConfirmPublish
}) => {
  const [note, setNote] = useState('');
  const [publishing, setPublishing] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onConfirmPublish(note || 'Admin Published Changes');
      setNote('');
      onClose();
    } catch (err) {
      alert('Failed to publish changes. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">Review & Publish Changes</h3>
              <p className="text-xs text-slate-400">
                You are about to publish {drafts.length} {drafts.length === 1 ? 'change' : 'changes'} live to all connected devices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-60">
          {drafts.map((d, idx) => (
            <div key={d.id || idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start justify-between text-xs space-y-1">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    d.action_type === 'CREATE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    d.action_type === 'STOCK_MOVEMENT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    d.action_type === 'DELETE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {d.action_type}
                  </span>
                  <span className="font-extrabold text-slate-200">{d.change_summary}</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-0.5">
                  SKU: {d.draft_payload?.sku || d.product_id}
                </p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>

        {/* Optional Release Note Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Release / Publication Note (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Morning Stock Count Audit & Received Bosch Shipment"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Warning Banner */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Once published, these changes will immediately update live inventory on all staff phones and computers.
          </span>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 fill-slate-950" />
            <span>{publishing ? 'Publishing Atomic Transaction...' : '🚀 Confirm & Publish Live'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
