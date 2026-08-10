import React from 'react';
import { Package, Sparkles, RefreshCw } from 'lucide-react';

interface SplashScreenProps {
  statusMessage?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  statusMessage = 'Syncing Live Stock Database...'
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="relative flex flex-col items-center max-w-sm w-full space-y-6 animate-in fade-in duration-300">
        
        {/* Glow Ring Behind Logo */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-amber-500/30 to-amber-700/20 blur-xl animate-pulse"></div>
          
          {/* Main Logo Container */}
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-2xl shadow-amber-500/30 border border-amber-400/40">
            <Package className="w-10 h-10 stroke-[2.5] animate-bounce" />
          </div>
        </div>

        {/* Title & Shop Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              Bahubali Enterprises
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Hardware Stock Management
          </p>
        </div>

        {/* Loading Spinner & Progress Line */}
        <div className="w-full space-y-3 pt-2">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2.5 px-4 rounded-xl">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>{statusMessage}</span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 font-mono">
          Powered by Supabase Realtime Engine
        </p>

      </div>
    </div>
  );
};
