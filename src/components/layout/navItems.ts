import { LayoutDashboard, Package, History, Table } from 'lucide-react';
import type { ActiveTab } from './BottomNav';

export const NAV_ITEMS: { id: ActiveTab; label: string; icon: typeof Package }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'history', label: 'History', icon: History },
  { id: 'datasheet', label: 'Data sheet', icon: Table }
];
