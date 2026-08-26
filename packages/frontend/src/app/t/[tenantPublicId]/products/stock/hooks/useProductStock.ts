'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/** One `/api/inventory` row, as the backend actually returns it. */
interface InventoryRow {
  id: string;
  productId: string;
  availableQty: number;
  reservedQty: number;
  defectiveQty: number;
  reorderLevel: number;
  updatedAt?: string;
  product?: {
    id: string;
    sku: string;
    name: string;
    barcode?: string | null;
    image?: string | null;
    categoryId?: string | null;
    warehouseName?: string | null;
    category?: { id: string; name: string } | null;
  } | null;
}

export interface StockRow {
  inventoryId: string;
  productId: string;
  sku: string;
  name: string;
  barcode: string | null;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** available + reserved: what is physically on the shelf. */
  totalQty: number;
  reservedQty: number;
  availableQty: number;
  defectiveQty: number;
  reorderLevel: number;
  /**
   * Always a single entry today. `Inventory` is keyed by (storeId, productId)
   * and carries no warehouseId, so there is no per-warehouse split to show.
   * Kept as a list so the column does not have to be rebuilt when there is.
   */
  warehouses: string[];
  lastMovementAt: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface StockFilters {
  search: string;
  warehouse: string;
  categoryId: string;
  onlyCritical: boolean;
}

export const STOCK_PAGE_SIZE = 20;

/** Below or at the row's own reorder level, and not yet zero. */
export function isCritical(row: StockRow): boolean {
  return row.totalQty > 0 && row.availableQty <= row.reorderLevel;
}

export function isOutOfStock(row: StockRow): boolean {
  return row.totalQty <= 0;
}

export function useProductStock() {
  const t = useTranslations('productStock');
  const { tenantContext } = useAuth();

  const [rows, setRows] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<StockFilters>({
    search: '',
    warehouse: 'all',
    categoryId: 'all',
    onlyCritical: false,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStock = useCallback(async () => {
    // `/api/inventory` answers 400 without an active store, so there is nothing
    // to ask for yet. The page renders the store-picker state instead.
    if (!tenantContext.storeId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<InventoryRow[]>('/inventory');
      setRows(
        (data || []).map((item) => {
          const warehouse = item.product?.warehouseName?.trim();
          return {
            inventoryId: item.id,
            productId: item.productId,
            sku: item.product?.sku || '—',
            name: item.product?.name || '—',
            barcode: item.product?.barcode || null,
            image: item.product?.image || null,
            categoryId: item.product?.category?.id ?? item.product?.categoryId ?? null,
            categoryName: item.product?.category?.name ?? null,
            totalQty: (item.availableQty || 0) + (item.reservedQty || 0),
            reservedQty: item.reservedQty || 0,
            availableQty: item.availableQty || 0,
            defectiveQty: item.defectiveQty || 0,
            reorderLevel: item.reorderLevel ?? 0,
            warehouses: warehouse ? [warehouse] : [],
            lastMovementAt: item.updatedAt || null,
          };
        }),
      );
    } catch (err: any) {
      setError(err?.message || t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext.storeId, t]);

  const fetchCategories = useCallback(async () => {
    if (!tenantContext.agencyId) return;
    try {
      const data = await apiFetch<Category[]>('/categories');
      setCategories(data || []);
    } catch (_) {
      // A missing category list only costs one filter; the table still works.
    }
  }, [tenantContext.agencyId]);

  useEffect(() => {
    fetchStock();
    fetchCategories();
  }, [fetchStock, fetchCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const warehouseOptions = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.warehouses))).sort(),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const hit =
            r.name.toLowerCase().includes(q) ||
            r.sku.toLowerCase().includes(q) ||
            (r.barcode || '').toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (filters.categoryId !== 'all' && r.categoryId !== filters.categoryId) return false;
        if (filters.warehouse !== 'all' && !r.warehouses.includes(filters.warehouse)) return false;
        if (filters.onlyCritical && !isCritical(r) && !isOutOfStock(r)) return false;
        return true;
      }),
    [rows, filters],
  );

  const kpi = useMemo(
    () => ({
      totalSkus: rows.length,
      critical: rows.filter(isCritical).length,
      outOfStock: rows.filter(isOutOfStock).length,
      reserved: rows.reduce((sum, r) => sum + r.reservedQty, 0),
    }),
    [rows],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / STOCK_PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * STOCK_PAGE_SIZE,
    currentPage * STOCK_PAGE_SIZE,
  );

  /**
   * Real write. `type` is the backend's AdjustmentType enum — sending anything
   * else fails validation, so the modal offers exactly these.
   */
  const adjustStock = async (payload: {
    productId: string;
    type: string;
    quantity: number;
    reason?: string;
  }): Promise<void> => {
    await apiFetch('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await fetchStock();
  };

  return {
    rows: paginated,
    allRows: rows,
    totalFiltered: filtered.length,
    categories,
    warehouseOptions,
    isLoading,
    error,
    filters,
    setFilters,
    currentPage,
    setCurrentPage,
    totalPages,
    kpi,
    fetchStock,
    adjustStock,
  };
}
