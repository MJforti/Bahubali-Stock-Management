import React, { useState } from 'react';
import { X, Settings, Database, Check, Sparkles, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { getStoredSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from '../../lib/supabase';

interface SupabaseConfigModalProps {
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ onClose }) => {
  const currentConfig = getStoredSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.key);
  const [copied, setCopied] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) return;
    saveSupabaseConfig(url, key);
  };

  const handleCopySchemaPath = () => {
    navigator.clipboard.writeText('supabase/schema.sql');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-extrabold text-slate-100">
              Supabase Realtime Cloud Settings
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto text-xs">
          
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Dual Backend Engine</span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Bahubali Enterprises system runs with zero-config local storage sync out-of-the-box. Connect your Supabase credentials below to enable multi-device live cloud sync across mobile phones & tablets!
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-300">Supabase Project URL</label>
              <input
                type="url"
                required
                placeholder="https://your-project.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Supabase Anon Key</label>
              <textarea
                rows={3}
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Database Setup Copy Code Tip */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>1-Click Database Setup Script</span>
              </span>
              <button
                type="button"
                onClick={handleCopySchemaPath}
                className="flex items-center gap-1 text-[10px] text-amber-400 font-bold hover:underline"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied Path!' : 'Copy SQL Path'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Run the SQL script inside <code className="text-amber-400 font-mono">supabase/schema.sql</code> in your Supabase SQL Editor to create tables, real-time channels, and storage bucket.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {currentConfig.isConfigured ? (
              <button
                type="button"
                onClick={() => clearSupabaseConfig()}
                className="text-rose-400 hover:underline font-bold text-[11px]"
              >
                Reset to Local Engine
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg"
              >
                Save & Connect Supabase
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
