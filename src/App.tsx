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
import { supabase, localBroadcastChannel } from './lib/supabase';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('local_demo');
  const [searchQuery, setSearchQuery] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);

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

  // Load Initial Data & Subscriptions
  const loadData = useCallback(async () => {
    try {
      const prodRes = await fetchProducts();
      setProducts(prodRes.products);
      setRealtimeStatus(prodRes.realtimeStatus);

      const txRes = await fetchStockTransactions();
      setTransactions(txRes);
    } catch (err) {
      console.error('Error loading inventory data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Supabase Real-time Cloud Subscriptions
    if (supabase) {
      const client = supabase;
      const channel = client
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          () => {
            fetchProducts().then((res) => setProducts(res.products));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'stock_transactions' },
          () => {
            fetchStockTransactions().then((res) => setTransactions(res));
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
          } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
            setRealtimeStatus('reconnecting');
          }
        });

      return () => {
        client.removeChannel(channel);
      };
    } else if (localBroadcastChannel) {
      const channel = localBroadcastChannel;
      // Local Multi-Tab Broadcast Sync Listener
      const handleLocalMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PRODUCTS_UPDATED') {
          setProducts(event.data.payload);
        } else if (event.data?.type === 'TRANSACTIONS_UPDATED') {
          setTransactions(event.data.payload);
        }
      };

      channel.addEventListener('message', handleLocalMessage);
      return () => {
        channel.removeEventListener('message', handleLocalMessage);
      };
    }
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

  // Handler Actions
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
      userName: userRole === 'admin' ? 'Raj (Admin)' : 'Amit (Staff)'
    });

    // Update local state
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
      userName: userRole === 'admin' ? 'Raj (Admin)' : 'Amit (Staff)'
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Navbar */}
      <Navbar
        currentRole={userRole}
        onRoleChange={setUserRole}
        realtimeStatus={realtimeStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onQuickSearchClick={() => setActiveTab('products')}
      />

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
      <ProductDetailModal
        product={selectedProductForDetail}
        transactions={transactions}
        userRole={userRole}
        onClose={() => setSelectedProductForDetail(null)}
        onOpenStockIn={(prod) => handleOpenStockIn(prod)}
        onOpenStockOut={(prod) => handleOpenStockOut(prod)}
        onOpenAdjustment={(prod) => setAdjustmentProduct(prod)}
        onOpenEditProduct={(prod) => {
          setSelectedProductForDetail(null);
          setProductForm({ open: true, product: prod });
        }}
      />

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

    </div>
  );
}
