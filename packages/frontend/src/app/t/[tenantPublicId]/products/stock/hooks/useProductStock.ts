'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/*
 * TODO(backend): per-warehouse stock split for the "Depo Dağılımı" column.
 *
 * There is no endpoint to add here yet, because the schema does not hold the
 * number the column wants. Four tables carry stock and none of them is a live
 * per-warehouse total (verified against packages/backend/prisma/schema.prisma):
 *
 *   Inventory          @@unique([storeId, productId]) — no warehouseId at all.
 *                      This is the live figure, and it is per STORE. It cannot
 *                      be split by warehouse, however the query is written.
 *   InventorySnapshot  has warehouseId, but @@unique([agencyId, date,
 *                      productId, warehouseId]) with `date @db.Date` — it is a
 *                      DAILY snapshot. Reading a split from it answers "as of
 *                      yesterday", never "right now". Showing that in a column
 *                      an operator uses to decide what to pick is worse than
 *                      showing nothing.
 *   StockMovement      has warehouseId, locationId, previousQty and newQty. A
 *                      live split is derivable here and only here: take the
 *                      newQty of the LATEST movement per (productId,
 *                      warehouseId) pair. That is the query to write.
 *   StockReservation   has warehouseId — needed to turn that split into an
 *                      available-per-warehouse figure rather than a total.
 *
 * And the larger question first: `Product.stockQuantity` (a denormalised total
 * on the product), `Inventory` (per store) and the warehouse-level movements
 * are THREE separate sources of stock, and which one is authoritative has not
 * been decided. Picking a source for this column silently picks it for the
 * system. That decision is its own db/prisma task — do not settle it here.
 *
 * Until then the column renders the single store-level entry it has.
 */

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
   * Always a single store-level entry today — see the TODO at the top of this
   * file for why there is no live per-warehouse split to put here. A list so
   * the column does not have to be rebuilt once there is one.
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
