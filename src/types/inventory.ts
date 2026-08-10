export type UserRole = 'admin' | 'staff';

export type TransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';

export type UnitType = 
  | 'Piece'
  | 'Box'
  | 'Packet'
  | 'Kg'
  | 'Liter'
  | 'Meter'
  | 'Coil'
  | 'Set'
  | 'Pair'
  | 'Bucket'
  | 'Roll'
  | 'Feet';

export interface Product {
  id: string;
  name: string;
  brand: string;
  brand_id?: string;
  category: string;
  category_id?: string;
  sub_category?: string;
  sku: string;
  description?: string;
  image_url?: string;
  unit: UnitType | string;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
  maximum_stock?: number;
  purchase_price: number;
  selling_price: number;
  supplier?: string;
  supplier_id?: string;
  rack?: string;
  shelf?: string;
  store_section?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface StockTransaction {
  id: string;
  product_id: string;
  type: TransactionType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  reference?: string;
  user_name: string;
  created_at: string;
  product_name?: string;
  product_sku?: string;
  product_image?: string;
  product_brand?: string;
}

export interface Brand {
  id: string;
  name: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  parent_category_id?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DashboardStats {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockAddedToday: number;
  stockRemovedToday: number;
}

export interface ExcelImportRow {
  name: string;
  brand: string;
  category: string;
  sku: string;
  stock: number;
  unit: string;
  min_stock?: number;
  purchase_price?: number;
  selling_price?: number;
  supplier?: string;
  rack?: string;
  description?: string;
  [key: string]: any;
}

export interface ExcelColumnMapping {
  name: string;
  brand: string;
  category: string;
  sku: string;
  stock: string;
  unit: string;
  min_stock: string;
  purchase_price: string;
  selling_price: string;
  supplier: string;
  rack: string;
}

export type RealtimeStatus = 'connected' | 'reconnecting' | 'local_demo';
