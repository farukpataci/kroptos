'use client';

import { useState } from 'react';
import { TagIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useProducts, Product, ProductPayload } from './hooks/useProducts';
import ProductsTable from './components/ProductsTable';
import ProductFormModal from './components/ProductFormModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import { useAuth } from '@/lib/auth-context';

export default function ProductsPage() {
  const { tenantContext } = useAuth();

  const {
    products,
    categories,
    isLoading,
    error,
    filters,
    setFilters,
    statusCounts,
    lowStockCount,
    outOfStockCount,
    totalFiltered,
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,
    LOW_STOCK_THRESHOLD,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getIntegrationLogs,
  } = useProducts();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined); // undefined = closed
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!tenantContext.storeId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <TagIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Store Seçimi Gerekli</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          Ürün kataloğunu yönetmek için üstteki bağlam çubuğundan aktif bir store seçin.
        </p>
      </div>
    );
  }

  const handleCreate = async (payload: ProductPayload) => {
    await createProduct(payload);
  };

  const handleUpdate = async (payload: ProductPayload) => {
    if (!editingProduct?.id) return;
    await updateProduct(editingProduct.id, payload);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteProduct(deletingProduct.id);
      // Close drawer if the deleted product was open
      if (selectedProduct?.id === deletingProduct.id) setSelectedProduct(null);
      setDeletingProduct(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Silme işlemi başarısız oldu.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <TagIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-kp-text-primary">Ürünler</h1>
            <p className="text-[13px] text-kp-text-tertiary">
              Ürün kataloğunu, fiyatlandırmayı ve SKU kodlarını yönetin
            </p>
          </div>
        </div>
        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-kp-danger">Ürünler yüklenemedi</p>
            <p className="text-xs text-kp-danger/80 mt-0.5">{error}</p>
          </div>
          <button onClick={fetchProducts} className="text-xs font-medium text-kp-danger hover:underline">
            Tekrar dene
          </button>
        </div>
      )}

      {/* Products Table */}
      {!error && (
        <ProductsTable
          products={products}
          categories={categories}
          isLoading={isLoading}
          filters={filters}
          statusCounts={statusCounts}
          lowStockCount={lowStockCount}
          outOfStockCount={outOfStockCount}
          totalFiltered={totalFiltered}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          lowStockThreshold={LOW_STOCK_THRESHOLD}
          onFilterChange={setFilters}
          onPageChange={setCurrentPage}
          onRowClick={(p) => setEditingProduct(p)}
          onEdit={(p) => setEditingProduct(p)}
          onDelete={(p) => { setDeleteError(null); setDeletingProduct(p); }}
          onAddProduct={() => setEditingProduct(null)}
        />
      )}

      {/* Create / Edit Modal */}
      {editingProduct !== undefined && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(undefined)}
          onSubmit={editingProduct ? handleUpdate : handleCreate}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingProduct && (
        <DeleteConfirmModal
          product={deletingProduct}
          onClose={() => { setDeletingProduct(null); setDeleteError(null); }}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
