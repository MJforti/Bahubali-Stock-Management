import React from 'react';
import { Package } from 'lucide-react';

interface SplashScreenProps {
  statusMessage?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ statusMessage = 'Opening stock register' }) => (
  <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
    <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
      <Package className="w-6 h-6" strokeWidth={2} />
    </div>
    <div>
      <h1 className="text-lg font-semibold text-slate-100">Bahubali Enterprises</h1>
      <p className="mt-1 text-sm text-slate-500">{statusMessage}</p>
    </div>
  </div>
);
