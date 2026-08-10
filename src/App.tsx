import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { fetchProducts, createProduct, updateProduct, getLocalProducts } from './services/productService';
import { fetchStockTransactions, recordStockMovement, getLocalTransactions } from './services/stockService';
import { exportInventoryToExcel } from './services/excelService';
import { supabase, localBroadcastChannel } from './lib/supabase';

import { SplashScreen } from './components/layout/SplashScreen';
import { AdminPasscodeModal } from './components/auth/AdminPasscodeModal';
import { DraftHeaderBar } from './components/admin/DraftHeaderBar';
import { PublishReviewModal } from './components/admin/PublishReviewModal';
import { PublishHistoryModal } from './components/admin/PublishHistoryModal';
import { UnsavedDraftsWarningModal } from './components/admin/UnsavedDraftsWarningModal';

import {
  ProductDraft,
  fetchProductDrafts,
  addProductDraft,
  discardAllDrafts,
  publishAllDrafts
} from './services/draftService';
import { setupRealtimeSync } from './services/realtimeSync';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('staff'); // STAFF VIEW BY DEFAULT
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('local_demo');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);

  // Published Inventory State (Staff View Source of Truth)
  const [publishedProducts, setPublishedProducts] = useState<Product[]>(() => getLocalProducts());
  const [transactions, setTransactions] = useState<StockTransaction[]>(() => getLocalTransactions());
  const [initialLoading, setInitialLoading] = useState<boolean>(() => getLocalProducts().length === 0);

  // Draft System States
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [unsavedWarningOpen, setUnsavedWarningOpen] = useState(false);

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

  // Compute Admin Draft View vs Staff Published View
  const visibleProducts = useMemo(() => {
    if (userRole === 'staff' || drafts.length === 0) {
      return publishedProducts;
    }

    // Apply Admin drafts on top of published inventory for Admin View
    let draftList = [...publishedProducts];
    for (const d of drafts) {
      const payload = d.draft_payload;
      if (d.action_type === 'CREATE' && payload) {
        const exists = draftList.some((p) => p.id === payload.id || p.sku === payload.sku);
        if (!exists) draftList = [payload, ...draftList];
      } else if ((d.action_type === 'UPDATE' || d.action_type === 'STOCK_MOVEMENT') && payload) {
        draftList = draftList.map((p) =>
          p.id === d.product_id || p.sku === payload.sku ? { ...p, ...payload } : p
        );
      } else if (d.action_type === 'DELETE') {
        draftList = draftList.filter((p) => p.id !== d.product_id && p.sku !== payload?.sku);
      }
    }
    return draftList;
  }, [userRole, publishedProducts, drafts]);

  // Load Initial Data & Drafts
  const loadData = useCallback(async () => {
    try {
      const [prodRes, txRes, draftRes] = await Promise.all([
        fetchProducts(),
        fetchStockTransactions(),
        fetchProductDrafts()
      ]);
      setPublishedProducts(prodRes.products);
      setRealtimeStatus(prodRes.realtimeStatus);
      setTransactions(txRes);
      setDrafts(draftRes);
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // Handle Role Switching & Unsaved Drafts Guard
  const handleRoleChangeRequest = (role: UserRole) => {
    if (role === 'admin') {
      setAdminAuthOpen(true);
    } else {
      if (drafts.length > 0) {
        setUnsavedWarningOpen(true);
      } else {
        setUserRole('staff');
      }
    }
  };

  useEffect(() => {
    loadData();

    // Centralized Dual-Trigger CDC + Broadcast Real-time Subscriptions
    const unsubscribe = setupRealtimeSync(
      async (event, payload) => {
        console.log(`🌐 Realtime Event [${event}]:`, payload);

        if (event === 'PRODUCTS_CDC' && payload?.new) {
          if (payload.eventType === 'INSERT') {
            setPublishedProducts((prev) => {
              const exists = prev.some((p) => p.id === payload.new.id || p.sku === payload.new.sku);
              return exists ? prev : [payload.new as Product, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setPublishedProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id || p.sku === payload.new.sku ? (payload.new as Product) : p))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setPublishedProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        } else if (event === 'TRANSACTIONS_CDC' && payload?.new) {
          setTransactions((prev) => [payload.new as StockTransaction, ...prev]);
        } else if (event === 'POLL_TRIGGER') {
          fetchProducts().then((res) => {
            if (res.products && res.products.length > 0) {
              setPublishedProducts(res.products);
            }
          });
        } else {
          // Full fresh data sync from Supabase PostgreSQL central database
          const [prodRes, txRes, draftRes] = await Promise.all([
            fetchProducts(),
            fetchStockTransactions(),
            fetchProductDrafts()
          ]);
          setPublishedProducts(prodRes.products);
          setTransactions(txRes);
          setDrafts(draftRes);
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
      const updated = visibleProducts.find((p: Product) => p.id === selectedProductForDetail.id);
      if (updated) {
        setSelectedProductForDetail(updated);
      }
    }
  }, [visibleProducts]);

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
    const { product, type, quantity, reason, reference } = params;
    let newStock = product.current_stock;
    if (type === 'IN') newStock += quantity;
    else if (type === 'OUT') newStock -= quantity;

    const summary = `${product.name}: ${type === 'IN' ? '+' : '-'}${quantity} ${product.unit}s (${product.current_stock} → ${newStock})`;

    await addProductDraft(
      product.id,
      'STOCK_MOVEMENT',
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
        current_stock: newStock,
        transaction: {
          product_id: product.id,
          type,
          quantity,
          previous_stock: product.current_stock,
          new_stock: newStock,
          reason: reason || (type === 'IN' ? 'Stock In Addition' : 'Stock Out Issue'),
          reference: reference || '',
          user_name: 'Raj (Admin)'
        }
      },
      summary
    );

    const freshDrafts = await fetchProductDrafts();
    setDrafts(freshDrafts);
  };

  const handleStockAdjustmentConfirm = async (params: {
    product: Product;
    type: 'ADJUSTMENT';
    quantity: number;
    reason: string;
  }) => {
    const { product, quantity, reason } = params;
    const summary = `${product.name}: Stock Adjustment (${product.current_stock} → ${quantity})`;

    await addProductDraft(
      product.id,
      'STOCK_MOVEMENT',
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
        current_stock: quantity,
        transaction: {
          product_id: product.id,
          type: 'ADJUSTMENT',
          quantity: Math.abs(quantity - product.current_stock),
          previous_stock: product.current_stock,
          new_stock: quantity,
          reason,
          user_name: 'Raj (Admin)'
        }
      },
      summary
    );

    const freshDrafts = await fetchProductDrafts();
    setDrafts(freshDrafts);
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (productForm.product?.id) {
      const prod = productForm.product;
      const summary = `Edit Product: ${productData.name || prod.name}`;
      await addProductDraft(
        prod.id,
        'UPDATE',
        { id: prod.id, sku: prod.sku, ...productData },
        summary
      );
    } else {
      const newId = `b1000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`;
      const fullProd = {
        ...productData,
        id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const summary = `Add Product: ${productData.name} (${productData.sku})`;
      await addProductDraft(newId, 'CREATE', fullProd, summary);
    }

    const freshDrafts = await fetchProductDrafts();
    setDrafts(freshDrafts);
  };

  const handleUpdateProductCell = async (id: string, updates: Partial<Product>) => {
    const prod = publishedProducts.find((p) => p.id === id);
    const summary = `Cell Edit: ${prod?.name || id}`;
    await addProductDraft(id, 'UPDATE', { id, sku: prod?.sku, ...updates }, summary);
    const freshDrafts = await fetchProductDrafts();
    setDrafts(freshDrafts);
  };

  const handleConfirmExcelImport = async (importedProducts: Partial<Product>[]) => {
    for (const prodData of importedProducts) {
      const newId = `b1000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`;
      const summary = `Import Product: ${prodData.name}`;
      await addProductDraft(newId, 'CREATE', { ...prodData, id: newId }, summary);
    }
    const freshDrafts = await fetchProductDrafts();
    setDrafts(freshDrafts);
  };

  const handleConfirmPublish = async (note: string) => {
    await publishAllDrafts('Raj (Admin)', note);
    setDrafts([]);
    await loadData();
  };

  const handleDiscardDrafts = async () => {
    await discardAllDrafts();
    setDrafts([]);
  };

  if (initialLoading) {
    return <SplashScreen statusMessage="Connecting to Bahubali Supabase Cloud..." />;
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

      {/* Admin Mode Persistent Draft Header Bar */}
      {userRole === 'admin' && (
        <DraftHeaderBar
          drafts={drafts}
          onOpenReview={() => setReviewModalOpen(true)}
          onOpenPublishModal={() => setReviewModalOpen(true)}
          onOpenHistory={() => setHistoryModalOpen(true)}
          onDiscardDrafts={handleDiscardDrafts}
          onExitAdmin={() => handleRoleChangeRequest('staff')}
        />
      )}

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {activeTab === 'dashboard' && (
          <DashboardView
            products={visibleProducts}
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
            products={visibleProducts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            userRole={userRole}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
            onOpenStockIn={(prod) => handleOpenStockIn(prod)}
            onOpenStockOut={(prod) => handleOpenStockOut(prod)}
            onOpenEditProduct={(prod) => setProductForm({ open: true, product: prod })}
            onOpenImportModal={() => setImportModalOpen(true)}
            onExportExcel={() => exportInventoryToExcel(visibleProducts)}
          />
        )}

        {activeTab === 'history' && (
          <StockHistoryView transactions={transactions} />
        )}

        {activeTab === 'datasheet' && (
          <InventoryDataSheet
            products={visibleProducts}
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
          products={visibleProducts}
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
          existingProducts={visibleProducts}
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

      {/* Review & Publish Changes Modal */}
      <PublishReviewModal
        isOpen={reviewModalOpen}
        drafts={drafts}
        onClose={() => setReviewModalOpen(false)}
        onConfirmPublish={handleConfirmPublish}
      />

      {/* Publish Version History Modal */}
      <PublishHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
      />

      {/* Unsaved Drafts Warning Modal */}
      <UnsavedDraftsWarningModal
        isOpen={unsavedWarningOpen}
        drafts={drafts}
        onKeepDraft={() => {
          setUnsavedWarningOpen(false);
          setUserRole('staff');
        }}
        onPublishNow={() => {
          setUnsavedWarningOpen(false);
          setReviewModalOpen(true);
        }}
        onDiscardAndExit={async () => {
          await handleDiscardDrafts();
          setUnsavedWarningOpen(false);
          setUserRole('staff');
        }}
      />

    </div>
  );
}
