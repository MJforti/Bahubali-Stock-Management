import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { BottomNav, ActiveTab } from './components/layout/BottomNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProductListView } from './components/products/ProductListView';
import { ProductDetailModal } from './components/products/ProductDetailModal';
import { ProductFormModal } from './components/products/ProductFormModal';
import { StockMovementModal } from './components/stock/StockMovementModal';
import { StockAdjustmentModal } from './components/stock/StockAdjustmentModal';
import { StockHistoryView } from './components/history/StockHistoryView';
import { InventoryDataSheet } from './components/datasheet/InventoryDataSheet';
import { ExcelImportModal } from './components/excel/ExcelImportModal';
import { SupabaseConfigModal } from './components/settings/SupabaseConfigModal';

import { Product, StockTransaction, UserRole, RealtimeStatus, TransactionType } from './types/inventory';
import { fetchProducts, createProduct, updateProduct } from './services/productService';
import { fetchStockTransactions, recordStockMovement } from './services/stockService';
import { exportInventoryToExcel } from './services/excelService';
import { setupRealtimeSync } from './services/realtimeSync';

import { SplashScreen } from './components/layout/SplashScreen';
import { AdminPasscodeModal } from './components/auth/AdminPasscodeModal';
import { ShieldCheck, Activity, Database, Radio } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('staff'); // STAFF VIEW BY DEFAULT
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connected');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<string>('Connected to Central DB');

  // Single Authoritative Products & Transactions State
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Modal States
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
  const [stockModal, setStockModal] = useState<{ open: boolean; type: TransactionType; product: Product | null }>({
    open: false,
    type: 'IN',
    product: null
  });
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Ultra-Fast Data Fetcher (Instant Hydration)
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch Products for instant UI render
      const prodRes = await fetchProducts();
      setProducts(prodRes.products);
      setRealtimeStatus(prodRes.realtimeStatus);
      setInitialLoading(false);

      // 2. Fetch Transaction History asynchronously in background without blocking initial render
      fetchStockTransactions().then((txs) => setTransactions(txs));
    } catch (err) {
      console.error('Error loading central inventory data:', err);
      setInitialLoading(false);
    }
  }, []);

  // Safety cutoff timer: Dismiss splash screen after 300ms max
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setInitialLoading(false);
    }, 300);
    return () => clearTimeout(splashTimer);
  }, []);

  // Real-time Subscriptions Setup
  useEffect(() => {
    loadData();

    const unsubscribe = setupRealtimeSync(
      async (event, payload) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastRealtimeEvent(`${event} at ${timeStr}`);

        if (event === 'PRODUCTS_CDC' && payload?.new) {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => {
              const exists = prev.some((p) => p.id === payload.new.id || p.sku === payload.new.sku);
              return exists ? prev : [payload.new as Product, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id || p.sku === payload.new.sku ? (payload.new as Product) : p))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        } else if (event === 'TRANSACTIONS_CDC' && payload?.new) {
          setProducts((currentProducts) => {
            const prod = currentProducts.find((p) => p.id === payload.new.product_id);
            const formattedTx: StockTransaction = {
              ...(payload.new as StockTransaction),
              product_name: prod?.name || (payload.new as any).product_name || 'Hardware Product',
              product_sku: prod?.sku || (payload.new as any).product_sku || '',
              product_brand: prod?.brand || (payload.new as any).product_brand || '',
              product_image: prod?.image_url || (payload.new as any).product_image || ''
            };
            setTransactions((prev) => [formattedTx, ...prev.filter((t) => t.id !== formattedTx.id)]);
            return currentProducts;
          });
        } else {
          // Refresh from central database
          const [prodRes, txRes] = await Promise.all([
            fetchProducts(),
            fetchStockTransactions()
          ]);
          setProducts(prodRes.products);
          setTransactions((prev) => {
            if (!txRes || txRes.length === 0) return prev;
            const mergedMap = new Map<string, StockTransaction>();
            txRes.forEach((t) => mergedMap.set(t.id, t));
            prev.forEach((t) => {
              if (!mergedMap.has(t.id)) mergedMap.set(t.id, t);
            });
            return Array.from(mergedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
        }
      },
      (status) => {
        setRealtimeStatus(status);
        if (status === 'connected') {
          loadData();
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Keep detail modal updated with latest stock
  useEffect(() => {
    if (selectedProductForDetail) {
      const updated = products.find((p) => p.id === selectedProductForDetail.id);
      if (updated) {
        setSelectedProductForDetail(updated);
      }
    }
  }, [products]);

  // Role Switcher
  const handleRoleChangeRequest = (role: UserRole) => {
    if (role === 'admin') {
      setAdminAuthOpen(true);
    } else {
      setUserRole('staff');
    }
  };

  // Direct Stock Movement Handlers
  const handleOpenStockIn = (product: Product | null = null) => {
    setStockModal({ open: true, type: 'IN', product });
  };

  const handleOpenStockOut = (product: Product | null = null) => {
    setStockModal({ open: true, type: 'OUT', product });
  };

  const handleStockConfirm = async (params: {
    product: Product;
    type: TransactionType;
    quantity: number;
    reason?: string;
    reference?: string;
  }) => {
    const res = await recordStockMovement({
      product: params.product,
      type: params.type,
      quantity: params.quantity,
      reason: params.reason,
      reference: params.reference,
      userName: 'Raj (Admin)'
    });

    setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
    setTransactions((prev) => [res.transaction, ...prev]);
  };

  const handleStockAdjustmentConfirm = async (params: {
    product: Product;
    type: 'ADJUSTMENT';
    quantity: number;
    reason: string;
  }) => {
    const res = await recordStockMovement({
      product: params.product,
      type: 'ADJUSTMENT',
      quantity: params.quantity,
      reason: params.reason,
      userName: 'Raj (Admin)'
    });

    setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
    setTransactions((prev) => [res.transaction, ...prev]);
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (productForm.product?.id) {
      const updated = await updateProduct(productForm.product.id, productData);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const created = await createProduct(productData as any);
      setProducts((prev) => [created, ...prev]);
    }
  };

  const handleUpdateProductCell = async (id: string, updates: Partial<Product>) => {
    const updated = await updateProduct(id, updates);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleConfirmExcelImport = async (importedProducts: Partial<Product>[]) => {
    for (const prodData of importedProducts) {
      const created = await createProduct(prodData as any);
      setProducts((prev) => [created, ...prev]);
    }
  };

  if (initialLoading) {
    return <SplashScreen statusMessage="Connecting to Bahubali Supabase Central Cloud..." />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Navbar */}
      <Navbar
        currentRole={userRole}
        onRoleChange={handleRoleChangeRequest}
        realtimeStatus={realtimeStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onQuickSearchClick={() => setActiveTab('products')}
      />

      {/* Admin Realtime Debug Diagnostic Header Bar */}
      {userRole === 'admin' && (
        <div className="bg-slate-900 border-b border-amber-500/30 text-slate-100 py-2 px-4 sticky top-16 z-25 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                ADMIN MODE (DIRECT DB WRITES)
              </span>
              <span className="hidden sm:flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                Central PostgreSQL DB
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Realtime: <strong className="text-emerald-400">ACTIVE</strong></span>
              <span className="text-slate-500 hidden md:inline">| {lastRealtimeEvent}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {activeTab === 'dashboard' && (
          <DashboardView
            products={products}
            transactions={transactions}
            userRole={userRole}
            onOpenStockIn={(prod) => handleOpenStockIn(prod)}
            onOpenStockOut={(prod) => handleOpenStockOut(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
            onGoToProductsSearch={() => setActiveTab('products')}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
          />
        )}

        {activeTab === 'products' && (
          <ProductListView
            products={products}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            userRole={userRole}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
            onOpenStockIn={(prod) => handleOpenStockIn(prod)}
            onOpenStockOut={(prod) => handleOpenStockOut(prod)}
            onOpenEditProduct={(prod) => setProductForm({ open: true, product: prod })}
            onOpenImportModal={() => setImportModalOpen(true)}
            onExportExcel={() => exportInventoryToExcel(products)}
          />
        )}

        {activeTab === 'history' && (
          <StockHistoryView transactions={transactions} />
        )}

        {activeTab === 'datasheet' && (
          <InventoryDataSheet
            products={products}
            userRole={userRole}
            onUpdateProduct={handleUpdateProductCell}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
          />
        )}

      </main>

      {/* Mobile Bottom Bar */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickStockClick={() => handleOpenStockIn()}
      />

      {/* MODALS */}
      
      {/* Product Details Modal */}
      {selectedProductForDetail && (
        <ProductDetailModal
          product={selectedProductForDetail}
          userRole={userRole}
          transactions={transactions}
          onClose={() => setSelectedProductForDetail(null)}
          onOpenStockIn={(prod) => handleOpenStockIn(prod)}
          onOpenStockOut={(prod) => handleOpenStockOut(prod)}
          onOpenAdjustment={(prod) => setAdjustmentProduct(prod)}
          onOpenEditProduct={(prod) => setProductForm({ open: true, product: prod })}
        />
      )}

      {/* Stock In / Stock Out Workflow Modal */}
      {stockModal.open && (
        <StockMovementModal
          initialType={stockModal.type}
          initialProduct={stockModal.product}
          products={products}
          onClose={() => setStockModal({ open: false, type: 'IN', product: null })}
          onConfirm={handleStockConfirm}
        />
      )}

      {/* Admin Stock Adjustment Modal */}
      {adjustmentProduct && (
        <StockAdjustmentModal
          product={adjustmentProduct}
          onClose={() => setAdjustmentProduct(null)}
          onConfirm={handleStockAdjustmentConfirm}
        />
      )}

      {/* Add / Edit Product Form Modal */}
      {productForm.open && (
        <ProductFormModal
          product={productForm.product}
          onClose={() => setProductForm({ open: false, product: null })}
          onSave={handleSaveProduct}
        />
      )}

      {/* Excel Import Modal */}
      {importModalOpen && (
        <ExcelImportModal
          existingProducts={products}
          onClose={() => setImportModalOpen(false)}
          onImportConfirmed={handleConfirmExcelImport}
        />
      )}

      {/* Supabase Connection Settings Modal */}
      {settingsModalOpen && (
        <SupabaseConfigModal onClose={() => setSettingsModalOpen(false)} />
      )}

      {/* Admin Security Passcode Unlock Modal */}
      <AdminPasscodeModal
        isOpen={adminAuthOpen}
        onClose={() => setAdminAuthOpen(false)}
        onSuccess={() => {
          setUserRole('admin');
          setAdminAuthOpen(false);
        }}
      />

    </div>
  );
}
