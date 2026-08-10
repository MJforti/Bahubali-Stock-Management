import React from 'react';
import { Package, Search, User, ShieldCheck, RefreshCw, Settings, Sparkles, AlertTriangle } from 'lucide-react';
import { UserRole, RealtimeStatus } from '../../types/inventory';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  realtimeStatus: RealtimeStatus;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onQuickSearchClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  realtimeStatus,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onQuickSearchClick
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Shop Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-extrabold shadow-lg shadow-amber-500/20">
              <Package className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                  Bahubali Enterprises
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Stock Register
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden xs:block">
                Live Inventory System
              </p>
            </div>
          </div>

          {/* Quick Search Input (Desktop/Tablet) */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, brands, SKU, rack (e.g. Bosch, 8mm, B-12)..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onClick={onQuickSearchClick}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Status & Role Controls */}
          <div className="flex items-center gap-2 xs:gap-3">

            {/* Realtime Status Indicator */}
            <div className="flex items-center">
              {realtimeStatus === 'connected' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="hidden xs:inline">Live Sync</span>
                </div>
              )}
              {realtimeStatus === 'reconnecting' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  <span className="hidden xs:inline">Reconnecting</span>
                </div>
              )}
              {realtimeStatus === 'local_demo' && (
                <button
                  onClick={onOpenSettings}
                  title="Running in local mode. Click to configure Supabase."
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:border-amber-500/50 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Local Engine</span>
                </button>
              )}
            </div>

            {/* Role Switcher */}
            <div className="relative flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => onRoleChange('admin')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentRole === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => onRoleChange('staff')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentRole === 'staff'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Staff</span>
              </button>
            </div>

            {/* Settings Modal Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700 transition-colors"
              title="Supabase Backend Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
