'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface Category {
  id: string;
  name: string;
  parentId?: string;
}

export interface Product {
  id: string;
  agencyId: string;
  clientId?: string;
  storeId: string;
  categoryId?: string;
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
  image?: string;
  erpCode?: string;
  erpId?: string;
  taxRate?: number;
  locationId?: string;
  locationCode?: string;
  locationBarcode?: string;
  warehouseName?: string;
  zoneName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPayload {
  categoryId?: string;
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
  image?: string;
  erpCode?: string;
  erpId?: string;
  taxRate?: number;
  type?: string;
  variantAttributes?: any;
  parentId?: string;
  bundleItems?: any[];
  crossSellProducts?: any[];
  variants?: any[];
  locationId?: string;
  locationCode?: string;
}

export interface ProductFilters {
  search: string;
  status: string;
  categoryId: string;
  stockLevel: string; // 'all' | 'low' | 'out'
}

const LOW_STOCK_THRESHOLD = 10;

export function useProducts() {
  const t = useTranslations('products');
  const { tenantContext } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'all',
    categoryId: 'all',
    stockLevel: 'all',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchProducts = useCallback(async () => {
    if (!tenantContext.storeId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(data || []);
    } catch (err: any) {
      setError(err.message || t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext.storeId]);

  const fetchCategories = useCallback(async () => {
    if (!tenantContext.agencyId) return;
    try {
      const data = await apiFetch<Category[]>('/categories');
      setCategories(data || []);
    } catch (_) {}
  }, [tenantContext.agencyId]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Client-side filtering
  const filteredProducts = products.filter((p) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q) &&
        !(p.barcode?.toLowerCase().includes(q))
      ) return false;
    }
    if (filters.status !== 'all' && p.status !== filters.status) return false;
    if (filters.categoryId !== 'all' && p.categoryId !== filters.categoryId) return false;
    if (filters.stockLevel === 'low' && p.stockQuantity > LOW_STOCK_THRESHOLD) return false;
    if (filters.stockLevel === 'out' && p.stockQuantity > 0) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Status counts
  const statusCounts = products.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const lowStockCount = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= LOW_STOCK_THRESHOLD).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  // Actions
  const createProduct = async (payload: ProductPayload): Promise<Product> => {
    const created = await apiFetch<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setProducts((prev) => [created, ...prev]);
    return created;
  };

  const updateProduct = async (id: string, payload: Partial<ProductPayload>): Promise<Product> => {
    const updated = await apiFetch<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    return updated;
  };

  const deleteProduct = async (id: string): Promise<void> => {
    await apiFetch(`/products/${id}`, { method: 'DELETE' });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const getIntegrationLogs = async (productId: string): Promise<any[]> => {
    try {
      const res = await apiFetch<any>(`/integration-logs?entityId=${productId}`);
      return res?.items || [];
    } catch {
      return [];
    }
  };

  const bulkAction = async (
    action: 'update_status' | 'update_location' | 'delete',
    productIds: string[],
    data?: any,
  ): Promise<void> => {
    await apiFetch('/products/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ action, productIds, data }),
    });
    await fetchProducts();
  };

  return {
    products: paginatedProducts,
    allProducts: products,
    categories,
    isLoading,
    error,
    filters,
    setFilters,
    statusCounts,
    lowStockCount,
    outOfStockCount,
    totalFiltered: filteredProducts.length,
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
    bulkAction,
  };
}
