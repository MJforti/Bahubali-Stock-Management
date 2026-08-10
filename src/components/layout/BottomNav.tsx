import React from 'react';
import { LayoutDashboard, Package, ArrowUpDown, History, Table, Plus } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'products' | 'stock_movement' | 'history' | 'datasheet';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickStockClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onQuickStockClick
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 md:hidden">
      <div className="flex items-center justify-around h-16 px-2 relative">
        
        {/* Dashboard */}
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        {/* Products */}
        <button
          onClick={() => onTabChange('products')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'products' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Products</span>
        </button>

        {/* Floating Center Stock In/Out Button */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={onQuickStockClick}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-slate-950 flex flex-col items-center justify-center shadow-lg shadow-amber-500/30 border-4 border-slate-950 active:scale-95 transition-transform"
            title="Quick Stock In / Stock Out"
          >
            <ArrowUpDown className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* History */}
        <button
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'history' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-5 h-5 mb-1" />
          <span className="text-[10px]">History</span>
        </button>

        {/* Data Sheet */}
        <button
          onClick={() => onTabChange('datasheet')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'datasheet' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Data Sheet</span>
        </button>

      </div>
    </nav>
  );
};
