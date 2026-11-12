import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { NAV_ITEMS } from './navItems';

export type ActiveTab = 'dashboard' | 'products' | 'history' | 'datasheet';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickStockClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, onQuickStockClick }) => {
  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors ${
          active ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-xs">{item.label}</span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 h-16 bg-slate-950 border-t border-slate-800 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center h-16 px-2">
        {NAV_ITEMS.slice(0, 2).map(renderItem)}
        <div className="flex-1 flex justify-center">
          <button
            onClick={onQuickStockClick}
            aria-label="Stock in or out"
            className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center active:scale-[0.98] transition-transform"
          >
            <ArrowUpDown className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        {NAV_ITEMS.slice(2).map(renderItem)}
      </div>
    </nav>
  );
};
