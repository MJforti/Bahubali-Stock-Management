import React from 'react';
import { ArrowUpDown, Package } from 'lucide-react';
import { NAV_ITEMS } from './navItems';
import type { ActiveTab } from './BottomNav';

interface SideNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickStockClick: () => void;
}

/** Desktop and tablet navigation (the bottom bar is phone-only). */
export const SideNav: React.FC<SideNavProps> = ({ activeTab, onTabChange, onQuickStockClick }) => (
  <aside className="hidden md:flex md:flex-col w-60 shrink-0 h-screen sticky top-0 bg-slate-950 border-r border-slate-800 px-3 py-4">
    <div className="flex items-center gap-3 px-2 h-10">
      <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
        <Package className="w-[18px] h-[18px]" strokeWidth={2} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold text-slate-100">Bahubali</p>
        <p className="text-xs text-slate-500">Stock register</p>
      </div>
    </div>

    <nav className="mt-8 flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`h-9 px-2 rounded-lg flex items-center gap-2.5 text-sm transition-colors ${
              active
                ? 'bg-slate-850 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
            }`}
          >
            <Icon className="w-[18px] h-[18px] text-slate-500" strokeWidth={1.5} />
            {item.label}
          </button>
        );
      })}
    </nav>

    <button
      onClick={onQuickStockClick}
      className="mt-auto h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
    >
      <ArrowUpDown className="w-4 h-4" strokeWidth={2} />
      Stock in / out
    </button>
  </aside>
);
