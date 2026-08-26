'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { SubPageShell, StoreRequired } from '@/components/layout/SubPageShell';
import { useProductStock, StockRow, STOCK_PAGE_SIZE } from './hooks/useProductStock';
import StockTable from './components/StockTable';
import StockAdjustModal from './components/StockAdjustModal';

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  tone: 'accent' | 'warning' | 'danger' | 'muted';
}) {
  const toneClass = {
    accent: 'bg-kp-accent/10 text-kp-accent',
    warning: 'bg-kp-warning/10 text-kp-warning',
    danger: 'bg-kp-danger/10 text-kp-danger',
    muted: 'bg-kp-bg-hover text-kp-text-secondary',
  }[tone];

  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-kp-md ${toneClass}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.625rem] uppercase tracking-wide text-kp-text-tertiary">
          {label}
        </p>
        <p className="text-lg font-semibold text-kp-text-primary">{value}</p>
      </div>
    </div>
  );
}

export default function ProductStockPage() {
  const t = useTranslations('productStock');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();

  const {
    rows,
    totalFiltered,
    categories,
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
  } = useProductStock();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);

  if (!tenantContext.storeId) {
    return (
      <StoreRequired
        icon={ArchiveBoxIcon}
        title={t('storeRequired.title')}
        description={t('storeRequired.desc')}
      />
    );
  }

  const toggleSelect = (productId: string) =>
    setSelectedIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );

  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      rows.every((r) => prev.includes(r.productId)) ? [] : rows.map((r) => r.productId),
    );

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={ArchiveBoxIcon}
      error={error}
      onReload={fetchStock}
      isLoading={isLoading}
      reloadLabel={tc('actions.refresh')}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CubeIcon} label={t('kpi.totalSkus')} value={kpi.totalSkus} tone="accent" />
        <KpiCard
          icon={ExclamationTriangleIcon}
          label={t('kpi.critical')}
          value={kpi.critical}
          tone="warning"
        />
        <KpiCard icon={XCircleIcon} label={t('kpi.outOfStock')} value={kpi.outOfStock} tone="danger" />
        <KpiCard icon={LockClosedIcon} label={t('kpi.reserved')} value={kpi.reserved} tone="muted" />
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kp-text-tertiary" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder={t('filters.searchHint')}
            aria-label={t('filters.search')}
            className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 py-2 pl-9 pr-3 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
          />
        </div>

        {/* No warehouse filter: `Inventory` has no warehouseId, so there is
            nothing to filter on. See the TODO in useProductStock.ts and
            docs/kararlar.md madde 1. */}
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          aria-label={t('filters.category')}
          className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
        >
          <option value="all">{t('filters.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs text-kp-text-secondary">
          <input
            type="checkbox"
            checked={filters.onlyCritical}
            onChange={(e) => setFilters({ ...filters, onlyCritical: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-kp-border accent-kp-accent"
          />
          {t('filters.onlyCritical')}
        </label>

        {/* Disabled on purpose: no bulk stock endpoint exists. Enabling it would
            mean firing one /inventory/adjust per row from the browser. */}
        <button
          type="button"
          disabled
          title={t('actions.bulkSoon')}
          className="cursor-not-allowed rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-tertiary opacity-50"
        >
          {t('actions.bulkUpdate')}
          {selectedIds.length > 0 && ` (${selectedIds.length})`}
        </button>
      </div>

      <StockTable
        rows={rows}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onAdjust={setAdjusting}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-kp-text-tertiary">
          <span>
            {t('pagination.showing', {
              from: (currentPage - 1) * STOCK_PAGE_SIZE + 1,
              to: Math.min(currentPage * STOCK_PAGE_SIZE, totalFiltered),
              total: totalFiltered,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-kp-md border border-kp-border px-3 py-1.5 font-semibold transition-all hover:bg-kp-bg-hover disabled:opacity-40"
            >
              {tc('actions.back')}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-kp-md border border-kp-border px-3 py-1.5 font-semibold transition-all hover:bg-kp-bg-hover disabled:opacity-40"
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      )}

      {adjusting && (
        <StockAdjustModal
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onSubmit={adjustStock}
        />
      )}
    </SubPageShell>
  );
}
