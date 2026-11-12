import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { canPromptInstall, isIos, isStandalone, onInstallAvailabilityChange, promptInstall } from '../../pwa';

/** Shows "Install" when the browser allows it; on iPhone/iPad, shows Add-to-Home-Screen steps. */
export const InstallButton: React.FC = () => {
  const [available, setAvailable] = useState(canPromptInstall());
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const off = onInstallAvailabilityChange(() => setAvailable(canPromptInstall()));
    return () => { off(); };
  }, []);

  if (isStandalone()) return null;
  const ios = isIos();
  if (!available && !ios) return null;

  return (
    <>
      <button
        onClick={() => (ios ? setShowIosHelp(true) : promptInstall())}
        title="Install the app on this device"
        className="h-9 px-2.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-850 text-sm flex items-center gap-2 transition-colors active:scale-[0.98]"
      >
        <Download className="w-4 h-4" strokeWidth={1.5} />
        <span className="hidden sm:inline">Install</span>
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950" onClick={() => setShowIosHelp(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 text-sm text-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Install on iPhone / iPad</h2>
              <button onClick={() => setShowIosHelp(false)} className="p-1.5 rounded-lg border border-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-3">
              <li className="flex items-center gap-2">1. Open this page in <strong>Safari</strong>.</li>
              <li className="flex items-center gap-2">2. Tap <Share className="w-4 h-4 text-slate-500" /> <strong>Share</strong>.</li>
              <li className="flex items-center gap-2">3. Tap <PlusSquare className="w-4 h-4 text-slate-500" /> <strong>Add to Home Screen</strong>.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};
