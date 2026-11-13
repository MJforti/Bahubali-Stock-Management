import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/layout/Navbar';
import { BottomNav, ActiveTab } from './components/layout/BottomNav';
import { SideNav } from './components/layout/SideNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProductListView } from './components/products/ProductListView';
import { ProductDetailModal } from './components/products/ProductDetailModal';
import { ProductFormModal } from './components/products/ProductFormModal';
import { StockMovementModal } from './components/stock/StockMovementModal';
import { StockAdjustmentModal } from './components/stock/StockAdjustmentModal';
import { StockHistoryView } from './components/history/StockHistoryView';
import { InventoryDataSheet } from './components/datasheet/InventoryDataSheet';
import { ExcelImportModal } from './components/excel/ExcelImportModal';
import { isUpdateReady, onUpdateReady, applyUpdate } from './pwa';
import { NamePicker } from './components/auth/NamePicker';
import { getCurrentStaff, setCurrentStaff, getRoster, STAFF_CHANGED_EVENT } from './lib/staffNames';
import { setActor, logActivity, fetchActivity, ActivityEntry } from './lib/activity';
import { StorePicker } from './components/stores/StorePicker';
import { ALL_STORES, STORES_CHANGED_EVENT, StoreScope, fetchStores, getSavedScope, saveScope, stockIn, stockMap } from './lib/stores';
import { Layers, Warehouse, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { BackupModal } from './components/settings/BackupModal';
import { refreshAlerts } from './lib/alerts';
import { exportStockReportPdf } from './services/pdfReport';

import { MAIN_STORE_ID, Product, StockTransaction, Store, UserRole, RealtimeStatus, TransactionType } from './types/inventory';
import { fetchProducts, createProduct, updateProduct, normalizeProduct } from './services/productService';
import { fetchStockTransactions, recordStockMovement, transferStock } from './services/stockService';
import { exportInventoryToExcel } from './services/excelService';
import { setupRealtimeSync } from './services/realtimeSync';
import { startSync, syncNow, onSyncStatus, SyncStatus } from './lib/sync';

import { SplashScreen } from './components/layout/SplashScreen';
import { AdminPasscodeModal } from './components/auth/AdminPasscodeModal';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('staff'); // STAFF VIEW BY DEFAULT
  const [currentStaff, setCurrentStaffState] = useState<string | null>(() => getCurrentStaff());
  const [namePickerOpen, setNamePickerOpen] = useState(false);
  // If this person was removed from the staff list (here or on another phone), ask who is using the app again
  const handleNamesChanged = useCallback(() => {
    const me = getCurrentStaff();
    if (!me) return;
    const removed = getRoster().some((e) => e.n.toLowerCase() === me.toLowerCase() && e.r);
    if (removed) {
      setCurrentStaff(null);
      setCurrentStaffState(null);
    }
  }, []);
  useEffect(() => {
    window.addEventListener(STAFF_CHANGED_EVENT, handleNamesChanged);
    return () => window.removeEventListener(STAFF_CHANGED_EVENT, handleNamesChanged);
  }, [handleNamesChanged]);
  const pickStaff = (name: string) => {
    if (name !== currentStaff) {
      // A different person must enter the admin code themselves
      if (userRole === 'admin' && currentStaff) {
        logActivity('people.admin_off', `Admin mode ended because ${name} took over`);
        setUserRole('staff');
      }
      setActor(name, 'staff');
      logActivity('people.switched', currentStaff ? `${name} took over from ${currentStaff}` : `${name} started using this phone`);
    }
    setCurrentStaff(name);
    setCurrentStaffState(name);
    setNamePickerOpen(false);
  };
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('local_demo');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<string>('Offline database ready');

  // Single Authoritative Products & Transactions State
  const [products, setProducts] = useState<Product[]>([]);

  // Stores: which one this phone is looking at, and the last one stock was moved in
  const [stores, setStores] = useState<Store[]>([]);
  const [scope, setScopeState] = useState<StoreScope>(() => getSavedScope());
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [lastStore, setLastStore] = useState<string>(() => {
    try {
      return localStorage.getItem('bahubali_last_store') || MAIN_STORE_ID;
    } catch {
      return MAIN_STORE_ID;
    }
  });
  const setScope = (next: StoreScope) => {
    setScopeState(next);
    saveScope(next);
  };
  const rememberStore = (id: string) => {
    setLastStore(id);
    try {
      localStorage.setItem('bahubali_last_store', id);
    } catch {
      /* ignore */
    }
  };
  const loadStores = useCallback(() => {
    fetchStores().then(setStores).catch((err) => console.error('Could not load stores', err));
  }, []);
  useEffect(() => {
    loadStores();
    window.addEventListener(STORES_CHANGED_EVENT, loadStores);
    return () => window.removeEventListener(STORES_CHANGED_EVENT, loadStores);
  }, [loadStores]);
  // If the store being viewed was removed (here or on another phone), show all stores
  useEffect(() => {
    if (scope !== ALL_STORES && stores.length && !stores.some((st) => st.id === scope && st.is_active)) setScope(ALL_STORES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);
  /** Store new stock goes to: the one being viewed, or the last one used when viewing all */
  const workingStore =
    scope !== ALL_STORES ? scope : stores.some((st) => st.id === lastStore && st.is_active) ? lastStore : MAIN_STORE_ID;
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(isUpdateReady());
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    const off = onUpdateReady(() => setUpdateReady(true));
    return () => { off(); };
  }, []);
  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  // Modal States
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
  const [stockModal, setStockModal] = useState<{ open: boolean; type: TransactionType | 'TRANSFER'; product: Product | null }>({
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
      setLoadError(null);
      setInitialLoading(false);

      // 2. Fetch Transaction History in background without blocking initial render.
      // Keep any rows we already have (e.g. just-recorded ones) that the fetch didn't return.
      await fetchStockTransactions()
        .then((txs) =>
          setTransactions((prev) => {
            const merged = new Map<string, StockTransaction>();
            txs.forEach((t) => merged.set(t.id, t));
            prev.forEach((t) => {
              if (!merged.has(t.id) && !t.id.startsWith('tx-')) merged.set(t.id, t);
            });
            return Array.from(merged.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          })
        )
        .catch((err) => console.error('Error loading stock history:', err));
    } catch (err: any) {
      console.error('Error loading central inventory data:', err);
      setLoadError(err?.message || 'Could not open the offline database.');
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

  // Load from the offline database, and keep other open tabs on this device in sync
  useEffect(() => {
    loadData();

    const unsubscribe = setupRealtimeSync((change) => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastRealtimeEvent(`${change.kind} at ${timeStr}`);

      if (change.kind === 'product') {
        const row = normalizeProduct(change.product);
        setProducts((prev) =>
          prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? row : p)) : [row, ...prev]
        );
      } else if (change.kind === 'product_delete') {
        setProducts((prev) => prev.filter((p) => p.id !== change.id));
      } else if (change.kind === 'transaction') {
        setTransactions((prev) => [change.transaction, ...prev.filter((t) => t.id !== change.transaction.id)]);
      } else if (change.kind === 'activity') {
        window.dispatchEvent(new CustomEvent('bahubali-activity'));
      } else {
        loadData();
        window.dispatchEvent(new CustomEvent('bahubali-activity'));
      }
    });

    // Central database: send this phone's changes, receive everyone else's (live)
    const stopSync = startSync(() => {
      loadData();
      window.dispatchEvent(new CustomEvent('bahubali-activity'));
    });

    return () => {
      unsubscribe();
      stopSync();
    };
  }, [loadData]);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle', pending: 0, live: false, lastSyncedAt: null, error: null });
  useEffect(() => {
    const off = onSyncStatus(setSyncStatus);
    return () => {
      off();
    };
  }, []);

  // Keep detail modal updated with latest stock
  useEffect(() => {
    if (selectedProductForDetail) {
      const updated = products.find((p) => p.id === selectedProductForDetail.id);
      if (updated) {
        setSelectedProductForDetail(updated);
      }
    }
  }, [products]);

  // Who is acting, for the activity log
  useEffect(() => {
    setActor(currentStaff, userRole);
    refreshAlerts();
  }, [currentStaff, userRole]);

  // Re-check alerts whenever the app comes back to the front (iPhones can drop them after an update)
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && refreshAlerts();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);

  // Activity log for the History page
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const loadActivity = useCallback(() => {
    fetchActivity().then(setActivity).catch((err) => console.error('Could not load activity', err));
  }, []);
  useEffect(() => {
    loadActivity();
    window.addEventListener('bahubali-activity', loadActivity);
    return () => window.removeEventListener('bahubali-activity', loadActivity);
  }, [loadActivity]);

  const leaveAdmin = () => {
    logActivity('people.admin_off', 'Left admin mode');
    setUserRole('staff');
  };

  // Role Switcher
  const handleRoleChangeRequest = (role: UserRole) => {
    if (role === 'admin') {
      setAdminAuthOpen(true);
    } else {
      leaveAdmin();
    }
  };

  const handleRemoveProduct = async (product: Product) => {
    const updated = await updateProduct(product.id, { is_active: false });
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProductForDetail(null);
  };

  // Direct Stock Movement Handlers
  const handleOpenStockIn = (product: Product | null = null) => {
    setStockModal({ open: true, type: 'IN', product });
  };

  const handleOpenStockOut = (product: Product | null = null) => {
    setStockModal({ open: true, type: 'OUT', product });
  };

  const handleOpenTransfer = (product: Product | null = null) => {
    setStockModal({ open: true, type: 'TRANSFER', product });
  };

  const staffName = () => currentStaff || (userRole === 'admin' ? 'Admin' : 'Staff');

  const applyMovementResult = (res: { product: Product; transaction: StockTransaction }, storeId: string) => {
    if (storeId !== MAIN_STORE_ID || scope === ALL_STORES) rememberStore(storeId);
    setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
    setTransactions((prev) => [res.transaction, ...prev.filter((t) => t.id !== res.transaction.id)]);
  };

  const handleStockConfirm = async (params: {
    product: Product;
    type: TransactionType;
    quantity: number;
    reason?: string;
    reference?: string;
    storeId: string;
  }) => {
    const res = await recordStockMovement({ ...params, userName: staffName() });
    applyMovementResult(res, params.storeId);
  };

  const handleTransfer = async (params: {
    product: Product;
    fromStoreId: string;
    toStoreId: string;
    quantity: number;
    reason?: string;
    reference?: string;
  }) => {
    const res = await transferStock({ ...params, userName: staffName() });
    setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
    setTransactions((prev) => [...res.transactions, ...prev.filter((t) => !res.transactions.some((n) => n.id === t.id))]);
  };

  const handleStockAdjustmentConfirm = async (params: {
    product: Product;
    type: 'ADJUSTMENT';
    quantity: number;
    reason: string;
    storeId: string;
  }) => {
    const res = await recordStockMovement({ ...params, userName: staffName() });
    applyMovementResult(res, params.storeId);
  };

  /**
   * Product edits must never overwrite stock directly: another device may have
   * moved stock since this form was opened, and every stock change needs a
   * history row. A changed stock value is applied as a count correction in the
   * store being viewed.
   */
  const applyProductEdit = async (id: string, updates: Partial<Product>, reason: string) => {
    const { current_stock: requestedStock, ...fieldUpdates } = updates;
    let latest = productsRef.current.find((p) => p.id === id);
    const stockChanged = latest && requestedStock !== undefined && Number(requestedStock) !== stockIn(latest, scope);
    if (stockChanged && scope === ALL_STORES) {
      throw new Error('Pick a store at the top first, so the app knows which store\'s stock to change');
    }

    if (Object.keys(fieldUpdates).length > 0) {
      latest = await updateProduct(id, fieldUpdates);
      const saved = latest;
      setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    }

    if (latest && stockChanged) {
      await handleStockAdjustmentConfirm({ product: latest, type: 'ADJUSTMENT', quantity: Number(requestedStock), reason, storeId: scope });
    }
  };

  const handleSaveProduct = async (productData: Partial<Product>, opts: { storeId?: string } = {}) => {
    if (productForm.product?.id) {
      const original = productForm.product;
      const updates = { ...productData };
      // Only treat stock as edited if the user actually changed the number in the form
      if (Number(updates.current_stock) === stockIn(original, scope)) {
        delete updates.current_stock;
      }
      await applyProductEdit(original.id, updates, 'Stock corrected via product edit form');
    } else {
      const created = await createProduct(productData as any, { storeId: opts.storeId || workingStore });
      setProducts((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
    }
  };

  const handleUpdateProductCell = async (id: string, updates: Partial<Product>) => {
    const original = productsRef.current.find((p) => p.id === id);
    const cellUpdates = { ...updates };
    if (original && Number(cellUpdates.current_stock) === stockIn(original, scope)) {
      delete cellUpdates.current_stock;
    }
    await applyProductEdit(id, cellUpdates, 'Stock corrected via inventory data sheet');
  };

  const handleConfirmExcelImport = async (importedProducts: Partial<Product>[]) => {
    const names: string[] = [];
    for (const prodData of importedProducts) {
      const openingByStore = prodData.opening_by_store && Object.keys(prodData.opening_by_store).length ? prodData.opening_by_store : undefined;
      const created = await createProduct(prodData as any, { silent: true, storeId: workingStore, openingByStore });
      names.push(created.name);
      setProducts((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
    }
    if (names.length) {
      await logActivity('product.imported', `Imported ${names.length} ${names.length === 1 ? 'product' : 'products'} from Excel`, {
        details: names.length > 8 ? [...names.slice(0, 8), `and ${names.length - 8} more`] : names
      });
    }
  };

  // ---------- Store scoping ----------
  const activeStores = stores.filter((st) => st.is_active);
  const storeName = (id: string) => stores.find((st) => st.id === id)?.name || 'Store';
  const scopeLabel = scope === ALL_STORES ? 'All stores' : storeName(scope);
  /** Products this view should show, with current_stock set to the selected store's stock */
  const scopedProducts =
    scope === ALL_STORES
      ? products
      : products.filter((p) => scope in stockMap(p)).map((p) => ({ ...p, current_stock: stockIn(p, scope) }));
  const handleExportPdf = async () => {
    try {
      const { products: n } = await exportStockReportPdf(products, { stores: activeStores, scope, by: currentStaff || (userRole === 'admin' ? 'Admin' : 'Staff') });
      logActivity('data.exported', `Exported a stock report PDF (${n} products, ${scopeLabel})`);
    } catch (err: any) {
      alert(err?.message || 'Could not make the PDF. Please try again');
    }
  };
  const scopedTransactions =
    scope === ALL_STORES ? transactions : transactions.filter((t) => (t.store_id || MAIN_STORE_ID) === scope);

  if (initialLoading) {
    return <SplashScreen statusMessage="Opening stock register" />;
  }

  return (
    <div className="min-h-screen bg-[#141415] text-slate-100 md:flex">
      <SideNav activeTab={activeTab} onTabChange={setActiveTab} onQuickStockClick={() => handleOpenStockIn()} />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
      {/* Top bar */}
      <Navbar
        currentRole={userRole}
        onRoleChange={handleRoleChangeRequest}
        realtimeStatus={realtimeStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onSync={async () => {
          await syncNow();
          await loadData();
        }}
        syncStatus={syncStatus}
        currentStaff={currentStaff}
        onOpenNamePicker={() => setNamePickerOpen(true)}
        onQuickSearchClick={() => setActiveTab('products')}
      />

      <button
        onClick={() => setStorePickerOpen(true)}
        className="border-b border-slate-800 bg-slate-950 px-4 md:px-6 h-11 flex items-center gap-2.5 text-left hover:bg-slate-900 transition-colors"
        aria-label={`Store: ${scopeLabel}. Change store`}
      >
        {scope === ALL_STORES ? <Layers className="w-4 h-4 text-slate-500" strokeWidth={1.5} /> : <Warehouse className="w-4 h-4 text-amber-400" strokeWidth={1.5} />}
        <span className="text-sm text-slate-500">Store</span>
        <span className="text-sm text-slate-100 truncate">{scopeLabel}</span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
        {scope === ALL_STORES && activeStores.length > 1 && (
          <span className="ml-auto text-xs text-slate-500 hidden sm:inline">Totals across {activeStores.length} stores</span>
        )}
      </button>

      {userRole === 'admin' && (
        <div className="border-b border-slate-800 bg-slate-950 px-4 md:px-6 h-9 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Admin mode
          </span>
          <button onClick={leaveAdmin} className="text-slate-500 hover:text-slate-100 transition-colors">
            Leave
          </button>
        </div>
      )}

      {/* Phones: a full-screen notice that can only be closed by updating */}
      {updateReady && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="update-title"
          className="md:hidden fixed inset-0 z-[100] bg-[#141415] flex flex-col items-center justify-center px-6 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center">
            <RefreshCw className="w-7 h-7" strokeWidth={2} />
          </div>
          <h2 id="update-title" className="mt-6 text-[22px] font-medium text-slate-100">Update the app</h2>
          <p className="mt-2 max-w-xs text-[15px] text-slate-400">
            A new version of Bahubali stock register is ready. Update to keep using the app
          </p>
          <p className="mt-3 max-w-xs text-sm text-slate-500">Your stock and any changes waiting to sync are kept</p>
          <button
            onClick={() => {
              setUpdating(true);
              applyUpdate();
            }}
            disabled={updating}
            autoFocus
            className="mt-8 w-full max-w-xs h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-base font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-70"
          >
            {updating && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
            {updating ? 'Updating' : 'Update now'}
          </button>
        </div>
      )}

      {/* Tablets and computers: a bar at the top */}
      {updateReady && (
        <div className="hidden md:block border-b border-slate-800 bg-slate-950 text-slate-300 text-sm px-4 md:px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            <span>A new version is ready. Your stock data stays as it is</span>
            <button
              onClick={applyUpdate}
              className="shrink-0 h-8 px-3 rounded-lg bg-slate-100 text-slate-950 font-medium hover:bg-white transition-colors"
            >
              Update now
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div className="border-b border-rose-500/30 bg-rose-950 text-rose-300 text-sm px-4 md:px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            <span>
              Stock data on this device could not be opened, so changes will not save ({loadError})
            </span>
            <button
              onClick={() => loadData()}
              className="shrink-0 h-8 px-3 rounded-lg border border-rose-500/40 font-medium hover:bg-rose-900 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Page Body */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-24 md:pb-10">
        
        {activeTab === 'dashboard' && (
          <DashboardView
            products={scopedProducts}
            transactions={scopedTransactions}
            scopeLabel={scopeLabel}
            userRole={userRole}
            canTransfer={activeStores.length > 1}
            onOpenTransfer={() => handleOpenTransfer()}
            onOpenStockIn={(prod) => handleOpenStockIn(prod)}
            onOpenStockOut={(prod) => handleOpenStockOut(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
            onGoToProductsSearch={() => setActiveTab('products')}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
            storeFigures={
              scope === ALL_STORES
                ? activeStores.map((st) => {
                    const live = products.filter((p) => p.is_active !== false);
                    return {
                      name: st.name,
                      units: live.reduce((a, p) => a + Math.max(0, stockIn(p, st.id)), 0),
                      value: live.reduce((a, p) => a + Math.max(0, stockIn(p, st.id)) * (Number(p.purchase_price) || 0), 0)
                    };
                  })
                : []
            }
          />
        )}

        {activeTab === 'products' && (
          <ProductListView
            products={scopedProducts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            userRole={userRole}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
            onOpenStockIn={(prod) => handleOpenStockIn(prod)}
            onOpenStockOut={(prod) => handleOpenStockOut(prod)}
            onOpenEditProduct={(prod) => setProductForm({ open: true, product: prod })}
            onOpenImportModal={() => setImportModalOpen(true)}
            onExportPdf={handleExportPdf}
            onExportExcel={() => {
              exportInventoryToExcel(products, { stores: activeStores, scope });
              logActivity('data.exported', `Exported ${scopedProducts.filter((p) => p.is_active !== false).length} products to Excel (${scopeLabel})`);
            }}
          />
        )}

        {activeTab === 'history' && (
          <StockHistoryView transactions={scopedTransactions} allTransactions={transactions} activity={activity} products={products} stores={stores} scopeLabel={scopeLabel} />
        )}

        {activeTab === 'datasheet' && (
          <InventoryDataSheet
            products={scopedProducts}
            userRole={userRole}
            scopeLabel={scopeLabel}
            canEditStock={scope !== ALL_STORES}
            onOpenImport={() => setImportModalOpen(true)}
            stores={stores}
            onUpdateProduct={handleUpdateProductCell}
            onSelectProduct={(prod) => setSelectedProductForDetail(prod)}
            onOpenAddProduct={() => setProductForm({ open: true, product: null })}
            onRemoveProduct={handleRemoveProduct}
            onExportPdf={handleExportPdf}
          />
        )}

      </main>
      </div>

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
          product={products.find((x) => x.id === selectedProductForDetail.id) || selectedProductForDetail}
          stores={stores}
          scope={scope}
          userRole={userRole}
          transactions={transactions}
          onClose={() => setSelectedProductForDetail(null)}
          onOpenStockIn={(prod) => handleOpenStockIn(prod)}
          onOpenStockOut={(prod) => handleOpenStockOut(prod)}
          onOpenTransfer={activeStores.length > 1 ? (prod) => handleOpenTransfer(prod) : undefined}
          onOpenAdjustment={(prod) => setAdjustmentProduct(prod)}
          onOpenEditProduct={(prod) => setProductForm({ open: true, product: prod })}
          onRemoveProduct={handleRemoveProduct}
        />
      )}

      {/* Stock In / Stock Out Workflow Modal */}
      {stockModal.open && (
        <StockMovementModal
          initialType={stockModal.type}
          initialProduct={stockModal.product ? products.find((x) => x.id === stockModal.product!.id) || stockModal.product : null}
          products={products}
          stores={stores}
          defaultStoreId={workingStore}
          onClose={() => setStockModal({ open: false, type: 'IN', product: null })}
          onConfirm={handleStockConfirm}
          onTransfer={handleTransfer}
        />
      )}

      {/* Admin Stock Adjustment Modal */}
      {adjustmentProduct && (
        <StockAdjustmentModal
          product={products.find((x) => x.id === adjustmentProduct.id) || adjustmentProduct}
          stores={stores}
          defaultStoreId={workingStore}
          onClose={() => setAdjustmentProduct(null)}
          onConfirm={handleStockAdjustmentConfirm}
        />
      )}

      {/* Add / Edit Product Form Modal */}
      {productForm.open && (
        <ProductFormModal
          product={
            productForm.product
              ? (() => {
                  const p = products.find((x) => x.id === productForm.product!.id) || productForm.product!;
                  return { ...p, current_stock: stockIn(p, scope) };
                })()
              : null
          }
          stores={stores}
          defaultStoreId={workingStore}
          scopeLabel={scopeLabel}
          canEditStock={scope !== ALL_STORES}
          onClose={() => setProductForm({ open: false, product: null })}
          onSave={handleSaveProduct}
        />
      )}

      {/* Excel Import Modal */}
      {importModalOpen && (
        <ExcelImportModal
          existingProducts={products}
          stores={stores}
          defaultStoreId={workingStore}
          onClose={() => setImportModalOpen(false)}
          onImportConfirmed={handleConfirmExcelImport}
        />
      )}

      {storePickerOpen && (
        <StorePicker
          stores={stores}
          products={products}
          scope={scope}
          isAdmin={userRole === 'admin'}
          onPick={(next) => {
            setScope(next);
            setStorePickerOpen(false);
          }}
          onClose={() => setStorePickerOpen(false)}
        />
      )}

      {/* Who's using the app */}
      {(!currentStaff || namePickerOpen) && (
        <NamePicker
          onListChanged={handleNamesChanged}
          current={currentStaff}
          canClose={!!currentStaff}
          onPick={pickStaff}
          onClose={() => setNamePickerOpen(false)}
        />
      )}

      {/* Offline Data & Backup Modal */}
      {settingsModalOpen && (
        <BackupModal
          isAdmin={userRole === 'admin'}
          syncStatus={syncStatus}
          onClose={() => setSettingsModalOpen(false)}
          onRestored={() => loadData()}
        />
      )}

      {/* Admin Security Passcode Unlock Modal */}
      <AdminPasscodeModal
        isOpen={adminAuthOpen}
        onClose={() => setAdminAuthOpen(false)}
        onSuccess={() => {
          setActor(currentStaff, 'admin');
          logActivity('people.admin_on', 'Entered admin mode');
          setUserRole('admin');
          setAdminAuthOpen(false);
        }}
      />

    </div>
  );
}
