'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import {
  TagIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';

interface Product {
  id: string;
  agencyId: string;
  clientId: string;
  storeId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  basePrice: number;
  costPrice?: number;
  barcode?: string;
  currency: string;
  stockQuantity: number;
  status: string;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  isActive: boolean;
}

export default function ProductsPage() {
  const { tenantContext } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    basePrice: '',
    costPrice: '',
    barcode: '',
    currency: 'TRY',
    stockQuantity: '0',
    status: 'active',
    weight: '',
    width: '',
    height: '',
    depth: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal States
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productIntegrationLogs, setProductIntegrationLogs] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantContext.agencyId && tenantContext.storeId) {
      fetchProducts();
    } else {
      setIsLoading(false);
    }
  }, [tenantContext.agencyId, tenantContext.storeId]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      description: '',
      price: '',
      basePrice: '',
      costPrice: '',
      barcode: '',
      currency: 'TRY',
      stockQuantity: '0',
      status: 'active',
      weight: '',
      width: '',
      height: '',
      depth: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku || '',
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      basePrice: product.basePrice?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      barcode: product.barcode || '',
      currency: product.currency || 'TRY',
      stockQuantity: product.stockQuantity?.toString() || '0',
      status: product.status || 'active',
      weight: product.weight?.toString() || '',
      width: product.width?.toString() || '',
      height: product.height?.toString() || '',
      depth: product.depth?.toString() || '',
    });
    setFormError(null);
    setIsModalOpen(true);
    
    try {
      const { items } = await apiFetch<any>(`/integration-logs?entityId=${product.id}`).catch(() => ({ items: [] }));
      setProductIntegrationLogs(items || []);
    } catch (e) {
      setProductIntegrationLogs([]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantContext.agencyId || !tenantContext.storeId) {
      setFormError('Agency and Store contexts are required');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    // Transform fields to numbers
    const payload = {
      sku: formData.sku,
      name: formData.name,
      description: formData.description || undefined,
      price: parseFloat(formData.price),
      basePrice: parseFloat(formData.basePrice),
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
      barcode: formData.barcode || undefined,
      currency: formData.currency,
      stockQuantity: parseInt(formData.stockQuantity, 10),
      status: formData.status,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      width: formData.width ? parseFloat(formData.width) : undefined,
      height: formData.height ? parseFloat(formData.height) : undefined,
      depth: formData.depth ? parseFloat(formData.depth) : undefined,
    };

    try {
      if (editingProduct) {
        // Update product
        const updated = await apiFetch<Product>(`/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
      } else {
        // Create product
        const created = await apiFetch<Product>('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setProducts([created, ...products]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/products/${productToDelete.id}`, {
        method: 'DELETE',
      });
      setProducts(products.filter(p => p.id !== productToDelete.id));
      setProductToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!tenantContext.storeId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <TagIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Store Context Required</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          Please choose an active store from the top context bar to manage product catalogs.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Failed to load products</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
        <button
          onClick={fetchProducts}
          className="mt-4 flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-medium text-white hover:bg-kp-accent-hover transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <TagIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-kp-text-primary">Products</h1>
            <p className="text-[13px] text-kp-text-tertiary">Manage catalog items, pricing parameters, and SKU codes</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
        >
          <PlusIcon className="h-4 w-4" /> Add Product
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-kp-text-tertiary">
                    No products added to this store yet. Click "Add Product" to create one.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-kp-text-primary">
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        {product.description && (
                          <p className="text-[10px] text-kp-text-tertiary max-w-xs truncate">{product.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-mono text-xs text-kp-text-primary">SKU: {product.sku}</p>
                        <p className="text-[10px] text-kp-text-tertiary">Barcode: {product.barcode || '-'}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-kp-text-primary">
                      {product.price ? `₺${parseFloat(product.price.toString()).toLocaleString()}` : '-'} {product.currency || 'TRY'}
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      <span className={product.stockQuantity <= 5 ? 'text-kp-danger font-semibold' : 'text-kp-text-secondary'}>
                        {product.stockQuantity} items
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={product.status === 'active' ? 'active' : product.status === 'suspended' ? 'error' : 'warning'} label={product.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-danger hover:bg-kp-bg-hover transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE & EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="my-8 w-full max-w-2xl bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary">
                {editingProduct ? 'Edit Catalog Product' : 'Add New Catalog Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="flex gap-2 p-3 text-xs border rounded-kp-md bg-kp-danger/10 border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Classic Runner Shoes"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      SKU Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. RUN-SHOES-001"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Product details, specs, sizes..."
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent h-20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Selling Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Base MSRP Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Cost Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Barcode
                    </label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="EAN/UPC code"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                      placeholder="0"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      placeholder="e.g. 1.25"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Width (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.width}
                        onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                        placeholder="0.0"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        placeholder="0.0"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Depth (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.depth}
                        onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                        placeholder="0.0"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* Integration History (Only on Edit) */}
                {editingProduct && (
                  <div className="mt-8 border-t border-kp-border pt-6">
                    <h4 className="text-xs font-semibold text-kp-text-primary mb-3">Integration History</h4>
                    <div className="border border-kp-border rounded-kp-md overflow-hidden bg-kp-bg-primary/20">
                      <table className="w-full text-left text-theme-sm">
                        <thead className="bg-kp-bg-primary/40 text-[10px] font-semibold uppercase text-kp-text-tertiary border-b border-kp-border">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Provider</th>
                            <th className="py-2 px-3">Operation</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                          {productIntegrationLogs && productIntegrationLogs.length > 0 ? (
                            productIntegrationLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="py-2.5 px-3 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                                <td className="py-2.5 px-3 font-medium capitalize">{log.provider}</td>
                                <td className="py-2.5 px-3 text-xs">{log.operation}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`badge ${log.status === 'success' ? 'badge--success' : log.status === 'failed' ? 'badge--danger' : 'badge--info'}`}>
                                    {log.status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-xs text-kp-text-tertiary">
                                No integration logs found for this product.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
                >
                  {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> Delete Product
              </h3>
              <button
                onClick={() => setProductToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-theme-sm text-kp-text-secondary">
                Are you sure you want to delete product <span className="font-semibold text-kp-text-primary">{productToDelete.name}</span> (SKU: {productToDelete.sku})? This action is soft-delete.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
              >
                {isDeleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
