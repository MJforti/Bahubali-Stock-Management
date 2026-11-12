import React, { useState } from 'react';
import { Package, Search, Lock, LockOpen, ArrowLeftRight, RefreshCw, Check } from 'lucide-react';
import { InstallButton } from './InstallButton';
import { UserRole, RealtimeStatus } from '../../types/inventory';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  realtimeStatus: RealtimeStatus;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onSync: () => Promise<void>;
  onQuickSearchClick: () => void;
  currentStaff: string | null;
  onOpenNamePicker: () => void;
}

const iconBtn =
  'h-9 px-2.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-850 text-sm flex items-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60';

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onSync,
  onQuickSearchClick,
  currentStaff,
  onOpenNamePicker
}) => {
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await onSync();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 1500);
    } finally {
      setSyncing(false);
    }
  };

  const isAdmin = currentRole === 'admin';

  return (
    <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <div className="h-14 px-4 md:px-6 flex items-center gap-3">
        {/* Logo (phones; the sidebar carries it on larger screens) */}
        <div className="flex items-center gap-2.5 md:hidden min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
            <Package className="w-[18px] h-[18px]" strokeWidth={2} />
          </div>
          <span className="text-[15px] font-semibold text-slate-100 truncate">Bahubali</span>
        </div>

        {/* Search (tablet and desktop) */}
        <div className="hidden md:block flex-1 max-w-md">
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
            <input
              type="search"
              placeholder="Search name, brand, SKU or rack"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={onQuickSearchClick}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <InstallButton />

          <button onClick={handleSync} disabled={syncing} title="Reload the latest data" className={iconBtn}>
            {justSynced ? (
              <Check className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            ) : (
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            )}
            <span className="hidden sm:inline">{syncing ? 'Syncing' : justSynced ? 'Synced' : 'Sync'}</span>
          </button>

          <button onClick={onOpenSettings} title="Share stock with another phone, or back up" className={iconBtn}>
            <ArrowLeftRight className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden lg:inline">Share</span>
          </button>

          <button onClick={onOpenNamePicker} title="Change who is using the app" className={`${iconBtn} max-w-[9rem]`}>
            <span className="w-5 h-5 shrink-0 rounded-full bg-slate-800 text-slate-200 text-xs flex items-center justify-center">
              {(currentStaff || '?').charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:inline truncate text-slate-200">{currentStaff || 'Pick name'}</span>
          </button>

          <button
            onClick={() => onRoleChange(isAdmin ? 'staff' : 'admin')}
            title={isAdmin ? 'Leave admin mode' : 'Enter admin code'}
            className={`${iconBtn} ${isAdmin ? '!text-amber-400 !border-slate-800' : ''}`}
          >
            {isAdmin ? <LockOpen className="w-4 h-4" strokeWidth={1.5} /> : <Lock className="w-4 h-4" strokeWidth={1.5} />}
            <span className="hidden sm:inline">{isAdmin ? 'Admin' : 'Staff'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
