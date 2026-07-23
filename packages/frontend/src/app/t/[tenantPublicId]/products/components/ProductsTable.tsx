'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  TagIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  SparklesIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Product, Category, ProductFilters } from '../hooks/useProducts';
import { ProductStatusBadge, StockBadge, MarginBadge, getProductImage } from './ProductStatusBadge';
import { useToast } from '@/components/ui/Toast';

interface ProductsTableProps {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  filters: ProductFilters;
  statusCounts: Record<string, number>;
  lowStockCount: number;
  outOfStockCount: number;
  totalFiltered: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  lowStockThreshold: number;
  salesMode?: 'single' | 'multi';
  onSalesModeChange?: (mode: 'single' | 'multi') => void;
  onAddBundle?: () => void;
  onFilterChange: (f: ProductFilters) => void;
  onPageChange: (p: number) => void;
  onRowClick: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddProduct: () => void;
  onBulkAction?: (action: 'update_status' | 'update_location' | 'delete', productIds: string[], data?: any) => Promise<void>;
}

const STATUS_TABS = [
  { value: 'all', labelKey: 'tabs.all' },
  { value: 'active', labelKey: 'tabs.active' },
  { value: 'draft', labelKey: 'tabs.draft' },
  { value: 'suspended', labelKey: 'tabs.suspended' },
];

export default function ProductsTable({
  products,
  categories,
  isLoading,
  filters,
  statusCounts,
  lowStockCount,
  outOfStockCount,
  totalFiltered,
  currentPage,
  totalPages,
  pageSize,
  lowStockThreshold,
  salesMode = 'single',
  onSalesModeChange,
  onAddBundle,
  onFilterChange,
  onPageChange,
  onRowClick,
  onEdit,
  onDelete,
  onAddProduct,
  onBulkAction,
}: ProductsTableProps) {
  const t = useTranslations('products.table');
  const tc = useTranslations('common');
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Modals States
  const [isBulkLocationModalOpen, setIsBulkLocationModalOpen] = useState(false);
  const [bulkLocationCode, setBulkLocationCode] = useState('');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  const isAllSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id));

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleToggleOne = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkStatusChange = async (statusVal: string) => {
    if (!statusVal || selectedIds.length === 0 || !onBulkAction) return;
    setIsSubmittingBulk(true);
    try {
      await onBulkAction('update_status', selectedIds, { status: statusVal });
      toast.success(t('bulk.statusUpdated', { count: selectedIds.length }));
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.message || t('bulk.statusUpdateFailed'));
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleBulkLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkLocationCode.trim() || selectedIds.length === 0 || !onBulkAction) return;
    setIsSubmittingBulk(true);
    try {
      await onBulkAction('update_location', selectedIds, { locationCode: bulkLocationCode.trim().toUpperCase() });
      toast.success(t('bulk.locationAssigned', { count: selectedIds.length, code: bulkLocationCode.trim().toUpperCase() }));
      setIsBulkLocationModalOpen(false);
      setBulkLocationCode('');
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.message || t('bulk.locationAssignFailed'));
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0 || !onBulkAction) return;
    setIsSubmittingBulk(true);
    try {
      await onBulkAction('delete', selectedIds);
      toast.success(t('bulk.deleted', { count: selectedIds.length }));
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.message || t('bulk.deleteFailed'));
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const singleCount = products.filter((p) => !p.isBundle).length;
  const multiCount = products.filter((p) => p.isBundle).length;

  const displayedProducts = products.filter((p) =>
    salesMode === 'multi' ? p.isBundle : !p.isBundle
  );

  return (
    <div className="space-y-4 relative">
      {/* Sales Mode Switcher (Tekli Satış vs Çoklu & Çapraz Satışlar) */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-kp-bg-secondary p-2 rounded-kp-lg border border-kp-border gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => onSalesModeChange?.('single')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-kp-md text-xs font-bold transition-all ${
              salesMode === 'single'
                ? 'bg-kp-accent text-white shadow-xs'
                : 'text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
            }`}
          >
            <TagIcon className="h-4 w-4" />
            <span>{t('salesMode.single')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${salesMode === 'single' ? 'bg-white/20 text-white' : 'bg-kp-bg-primary text-kp-text-tertiary'}`}>
              {singleCount}
            </span>
          </button>

          <button
            onClick={() => onSalesModeChange?.('multi')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-kp-md text-xs font-bold transition-all ${
              salesMode === 'multi'
                ? 'bg-kp-accent text-white shadow-xs'
                : 'text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
            }`}
          >
            <SparklesIcon className="h-4 w-4" />
            <span>{t('salesMode.multi')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${salesMode === 'multi' ? 'bg-white/20 text-white' : 'bg-kp-bg-primary text-kp-text-tertiary'}`}>
              {multiCount}
            </span>
          </button>
        </div>

        {salesMode === 'multi' && (
          <button
            onClick={onAddBundle}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors"
          >
            <span>+ {t('salesMode.addBundle')}</span>
          </button>
        )}
      </div>

      {/* Top Filter Tabs & Stats Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? totalFiltered : statusCounts[tab.value] || 0;
            const isActive = filters.status === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onFilterChange({ ...filters, status: tab.value })}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-kp-md text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-kp-accent text-white shadow-xs'
                    : 'text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                }`}
              >
                <span>{t(tab.labelKey)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-kp-bg-primary text-kp-text-tertiary'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <button
              onClick={() => onFilterChange({ ...filters, stockLevel: filters.stockLevel === 'low' ? 'all' : 'low' })}
              className={`px-2.5 py-1 rounded-kp-md text-[11px] font-semibold border transition-all ${
                filters.stockLevel === 'low'
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              ⚠️ {t('lowStockFilter', { count: lowStockCount })}
            </button>
          )}

          {outOfStockCount > 0 && (
            <button
              onClick={() => onFilterChange({ ...filters, stockLevel: filters.stockLevel === 'out' ? 'all' : 'out' })}
              className={`px-2.5 py-1 rounded-kp-md text-[11px] font-semibold border transition-all ${
                filters.stockLevel === 'out'
                  ? 'bg-kp-danger/20 text-kp-danger border-kp-danger/40'
                  : 'bg-kp-danger/10 text-kp-danger border-kp-danger/20 hover:bg-kp-danger/20'
              }`}
            >
              🚫 {t('outOfStockFilter', { count: outOfStockCount })}
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar: Search, Category Filter, Add Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3 max-w-xl">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
          </div>

          {/* Category Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={filters.categoryId}
              onChange={(e) => onFilterChange({ ...filters, categoryId: e.target.value })}
              className="w-full appearance-none bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-8 pr-7 py-1.5 text-xs text-kp-text-secondary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
            >
              <option value="all">{t('allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FunnelIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary pointer-events-none" />
          </div>

          {/* Stock Filter Dropdown */}
          <div className="relative min-w-[120px]">
            <select
              value={filters.stockLevel}
              onChange={(e) => onFilterChange({ ...filters, stockLevel: e.target.value })}
              className="w-full appearance-none bg-kp-bg-secondary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-secondary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
            >
              <option value="all">{t('stockFilter.all')}</option>
              <option value="in_stock">{t('stockFilter.inStock')}</option>
              <option value="low">{t('stockFilter.low')}</option>
              <option value="out">{t('stockFilter.out')}</option>
            </select>
          </div>
        </div>

        {/* Add Product Button (Only shown in single mode, in multi mode it is at top right) */}
        {salesMode === 'single' && (
          <button
            onClick={onAddProduct}
            className="flex items-center justify-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors"
          >
            <span>+ {t('addProduct')}</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-kp-border rounded-kp-md bg-kp-bg-primary/10">
        <table className="w-full text-left border-collapse text-xs text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[10px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleAll}
                  className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent cursor-pointer"
                />
              </th>
              <th className="py-3 px-4 w-10" />
              {salesMode === 'single' ? (
                <>
                  <th className="py-3 px-4">{t('columns.product')}</th>
                  <th className="py-3 px-4">{t('columns.skuBarcode')}</th>
                  <th className="py-3 px-4">{t('columns.location')}</th>
                  <th className="py-3 px-4 text-right">{t('columns.price')}</th>
                  <th className="py-3 px-4 text-center">{t('columns.stock')}</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4">{t('bundle.colBundle')}</th>
                  <th className="py-3 px-4">{t('bundle.colComponents')}</th>
                  <th className="py-3 px-4 text-right">{t('bundle.colPriceDiscount')}</th>
                  <th className="py-3 px-4 text-center">{t('bundle.colComponentStock')}</th>
                </>
              )}
              <th className="py-3 px-4 text-center">{t('columns.margin')}</th>
              <th className="py-3 px-4">{t('columns.status')}</th>
              <th className="py-3 px-4 text-right">{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="py-4 px-4">
                      <div className="h-3 rounded bg-kp-bg-tertiary animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayedProducts.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{salesMode === 'multi' ? '✨' : '🏷️'}</span>
                    <p className="text-sm font-medium text-kp-text-secondary">
                      {salesMode === 'multi' ? t('bundle.emptyTitle') : t('empty.title')}
                    </p>
                    <p className="text-xs text-kp-text-tertiary">
                      {salesMode === 'multi'
                        ? t('bundle.emptyDesc')
                        : t('empty.noProducts')}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedProducts.map((product) => {
                const isSelected = selectedIds.includes(product.id);
                return (
                  <tr
                    key={product.id}
                    onClick={() => onRowClick(product)}
                    className={`hover:bg-kp-bg-hover/40 transition-colors cursor-pointer group ${
                      isSelected ? 'bg-kp-accent/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleOne(product.id, e)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent cursor-pointer"
                      />
                    </td>

                    {/* Image */}
                    <td className="py-3 px-4">
                      <div className="h-9 w-9 flex-shrink-0 rounded-kp-sm border border-kp-border overflow-hidden bg-kp-bg-primary flex items-center justify-center">
                        {getProductImage(product.image) ? (
                          <img src={getProductImage(product.image)} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <PhotoIcon className="h-4 w-4 text-kp-text-tertiary" />
                        )}
                      </div>
                    </td>

                    {salesMode === 'single' ? (
                      <>
                        {/* Product Name */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-semibold text-kp-text-primary text-[12px] group-hover:text-kp-accent transition-colors">
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="text-[10px] text-kp-text-tertiary max-w-xs truncate">{product.description}</p>
                            )}
                          </div>
                        </td>

                        {/* SKU / Barcode */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-mono text-[11px] font-medium text-kp-text-primary">{product.sku}</p>
                            {product.barcode && (
                              <p className="text-[10px] text-kp-text-tertiary">{product.barcode}</p>
                            )}
                          </div>
                        </td>

                        {/* Location / Address */}
                        <td className="py-3 px-4">
                          {product.locationCode ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-kp-xs text-[10px] font-mono font-semibold bg-kp-accent/10 text-kp-accent border border-kp-accent/20">
                                <TagIcon className="h-3 w-3" />
                                {product.locationCode}
                              </span>
                              {product.warehouseName && (
                                <p className="text-[9px] text-kp-text-tertiary truncate max-w-[120px]" title={`${product.warehouseName}${product.zoneName ? ` - ${product.zoneName}` : ''}`}>
                                  {product.warehouseName}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-kp-text-tertiary italic">{t('notAssigned')}</span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right">
                          <div>
                            <p className="font-semibold text-kp-text-primary text-[12px]">
                              {product.currency === 'TRY' ? '₺' : product.currency === 'USD' ? '$' : '€'}
                              {parseFloat(product.price.toString()).toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            {product.basePrice && product.basePrice !== product.price && (
                              <p className="text-[10px] text-kp-text-tertiary line-through">
                                {product.currency === 'TRY' ? '₺' : '$'}
                                {parseFloat(product.basePrice.toString()).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-4 text-center">
                          <StockBadge quantity={product.stockQuantity} threshold={lowStockThreshold} />
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Bundle Product Name & SKU */}
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-kp-accent/10 text-kp-accent border border-kp-accent/20 uppercase">
                                {t('bundle.badge')}
                              </span>
                              <p className="font-semibold text-kp-text-primary text-[12px] group-hover:text-kp-accent transition-colors">
                                {product.name}
                              </p>
                            </div>
                            <p className="font-mono text-[10px] text-kp-text-tertiary mt-0.5">{product.sku}</p>
                          </div>
                        </td>

                        {/* Bundle Components */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-kp-xs text-[10px] font-medium bg-kp-bg-secondary text-kp-text-secondary border border-kp-border">
                              {t('bundle.sampleComponents')}
                            </span>
                          </div>
                        </td>

                        {/* Bundle Price & Discount */}
                        <td className="py-3 px-4 text-right">
                          <div>
                            <p className="font-bold text-emerald-600 text-[12px] font-mono">
                              ₺{parseFloat(product.price.toString()).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </p>
                            <span className="inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600">
                              {t('bundle.sampleDiscount')}
                            </span>
                          </div>
                        </td>

                        {/* Bundle Component Stock Status */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {t('bundle.allInStock', { count: product.stockQuantity })}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Margin */}
                    <td className="py-3 px-4 text-center">
                      <MarginBadge price={product.price} costPrice={product.costPrice} />
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <ProductStatusBadge status={product.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(product)}
                          className="flex h-7 w-7 items-center justify-center rounded-kp-sm text-kp-text-tertiary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                          title={tc('actions.edit')}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(product)}
                          className="flex h-7 w-7 items-center justify-center rounded-kp-sm text-kp-text-tertiary hover:text-kp-danger hover:bg-kp-bg-hover transition-colors"
                          title={tc('actions.delete')}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-kp-text-tertiary">
            {t.rich('pagination', {
              total: totalFiltered,
              range: `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalFiltered)}`,
              b: (chunks) => <span className="font-semibold text-kp-text-secondary">{chunks}</span>,
              mono: (chunks) => <span className="font-semibold text-kp-text-secondary font-mono">{chunks}</span>,
            })}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-kp-sm border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover disabled:opacity-40 transition-colors"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`h-7 min-w-[28px] px-1.5 rounded-kp-sm text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-kp-accent text-white'
                      : 'border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-kp-sm border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover disabled:opacity-40 transition-colors"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-kp-lg bg-kp-bg-secondary/95 border border-kp-border shadow-kp-elevated backdrop-blur-md animate-slide-up">
          <div className="flex items-center gap-2 pr-3 border-r border-kp-border">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent text-white text-[11px] font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-kp-text-primary">
              {t('bulk.selected')}
            </span>
          </div>

          {/* Status Bulk Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-kp-text-tertiary">{t('columns.status')}:</span>
            <select
              disabled={isSubmittingBulk}
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-kp-bg-primary border border-kp-border rounded-kp-md text-xs px-2.5 py-1 focus:outline-hidden text-kp-text-primary cursor-pointer disabled:opacity-50"
            >
              <option value="">{t('bulk.selectPlaceholder')}</option>
              <option value="active">{t('bulk.makeActive')}</option>
              <option value="draft">{t('bulk.makeDraft')}</option>
              <option value="suspended">{t('bulk.makeSuspended')}</option>
            </select>
          </div>

          {/* Location Bulk Assign Button */}
          <button
            onClick={() => setIsBulkLocationModalOpen(true)}
            disabled={isSubmittingBulk}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-kp-md border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-primary transition-colors disabled:opacity-50"
          >
            <TagIcon className="h-3.5 w-3.5 text-kp-accent" />
            {t('bulk.assignLocation')}
          </button>

          {/* Delete Bulk Button */}
          <button
            onClick={() => setIsBulkDeleteModalOpen(true)}
            disabled={isSubmittingBulk}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-kp-md bg-kp-danger hover:bg-red-600 text-white transition-colors disabled:opacity-50"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {t('bulk.bulkDelete')}
          </button>

          {/* Clear Selection */}
          <button
            onClick={() => setSelectedIds([])}
            className="p-1 text-kp-text-tertiary hover:text-kp-text-primary transition-colors ml-1"
            title={t('bulk.clearSelection')}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bulk Location Modal */}
      {isBulkLocationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                {t('bulkLocationModal.title')}
              </h3>
              <button
                onClick={() => setIsBulkLocationModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBulkLocationSubmit}>
              <div className="p-6 space-y-3">
                <p className="text-xs text-kp-text-secondary">
                  {t.rich('bulkLocationModal.desc', {
                    count: selectedIds.length,
                    b: (chunks) => <span className="font-semibold text-kp-accent">{chunks}</span>,
                  })}
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">{t('bulkLocationModal.codeLabel')}</label>
                  <input
                    type="text"
                    required
                    value={bulkLocationCode}
                    onChange={(e) => setBulkLocationCode(e.target.value.toUpperCase())}
                    placeholder={t('bulkLocationModal.codePlaceholder')}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkLocationModalOpen(false)}
                  disabled={isSubmittingBulk}
                  className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
                >
                  {tc('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk}
                  className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmittingBulk && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                  {t('bulkLocationModal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> {t('bulkDeleteModal.title')}
              </h3>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                {t.rich('bulkDeleteModal.desc', {
                  count: selectedIds.length,
                  b: (chunks) => <span className="font-bold text-kp-danger">{chunks}</span>,
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isSubmittingBulk}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={isSubmittingBulk}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {isSubmittingBulk && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                {t('bulkDeleteModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
