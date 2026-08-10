import React, { useState, useEffect } from 'react';
import { History, X, CheckCircle2, User, Calendar } from 'lucide-react';
import { fetchPublishHistory, InventoryVersion } from '../../services/draftService';

interface PublishHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublishHistoryModal: React.FC<PublishHistoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const [history, setHistory] = useState<InventoryVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchPublishHistory().then((res) => {
        setHistory(res);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">Publication Version History</h3>
              <p className="text-xs text-slate-400">
                Audit log of all published inventory versions and release notes.
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

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500 font-bold">
              Loading publication logs...
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-bold">
              No publication logs recorded yet.
            </div>
          ) : (
            history.map((ver) => (
              <div key={ver.version} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs rounded-full">
                      Version {ver.version}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {ver.changes_count} {ver.changes_count === 1 ? 'Change' : 'Changes'} Published
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {new Date(ver.published_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                {ver.note && (
                  <p className="text-xs text-slate-300 font-medium bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                    "{ver.note}"
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-850">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-amber-400" />
                    <span>Published by: {ver.published_by}</span>
                  </span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Live on Cloud</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all"
          >
            Close History
          </button>
        </div>

      </div>
    </div>
  );
};
