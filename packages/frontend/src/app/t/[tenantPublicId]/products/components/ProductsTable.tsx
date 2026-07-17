'use client';

import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { Product, Category, ProductFilters } from '../hooks/useProducts';
import { ProductStatusBadge, StockBadge, MarginBadge, getProductImage } from './ProductStatusBadge';

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
  onFilterChange: (f: ProductFilters) => void;
  onPageChange: (p: number) => void;
  onRowClick: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddProduct: () => void;
}

const STATUS_TABS = [
  { value: 'all', label: 'Tümü' },
  { value: 'active', label: 'Aktif' },
  { value: 'draft', label: 'Taslak' },
  { value: 'suspended', label: 'Askıda' },
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
  onFilterChange,
  onPageChange,
  onRowClick,
  onEdit,
  onDelete,
  onAddProduct,
}: ProductsTableProps) {
  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(startIdx + products.length - 1, totalFiltered);

  return (
    <div className="card overflow-hidden">
      {/* Status Tabs */}
      <div className="border-b border-kp-border">
        <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? totalAll : statusCounts[tab.value] || 0;
            const isActive = filters.status === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onFilterChange({ ...filters, status: tab.value })}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-[12px] font-medium transition-all border-b-2 ${
                  isActive
                    ? 'border-kp-accent text-kp-accent'
                    : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive ? 'bg-kp-accent/15 text-kp-accent' : 'bg-kp-bg-tertiary text-kp-text-tertiary'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kp-text-tertiary" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              placeholder="Ürün adı, SKU veya barkod..."
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md pl-8 pr-4 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-3.5 w-3.5 text-kp-text-tertiary flex-shrink-0" />
            <select
              value={filters.categoryId}
              onChange={(e) => onFilterChange({ ...filters, categoryId: e.target.value })}
              className="bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Stock filter */}
          <select
            value={filters.stockLevel}
            onChange={(e) => onFilterChange({ ...filters, stockLevel: e.target.value })}
            className="bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
          >
            <option value="all">Tüm Stoklar</option>
            <option value="low">Az Stok (≤{lowStockThreshold})</option>
            <option value="out">Tükendi</option>
          </select>

          {/* Stock alert pills */}
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <button
                onClick={() => onFilterChange({ ...filters, stockLevel: 'low' })}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                ⚠ {lowStockCount} az stok
              </button>
            )}
            {outOfStockCount > 0 && (
              <button
                onClick={() => onFilterChange({ ...filters, stockLevel: 'out' })}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                ✕ {outOfStockCount} tükendi
              </button>
            )}
          </div>

          <div className="ml-auto">
            <button
              onClick={onAddProduct}
              className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
            >
              <span className="text-base leading-none">+</span>
              Ürün Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[10px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4 w-10" />
              <th className="py-3 px-4">Ürün</th>
              <th className="py-3 px-4">SKU / Barkod</th>
              <th className="py-3 px-4 text-right">Fiyat</th>
              <th className="py-3 px-4 text-center">Stok</th>
              <th className="py-3 px-4 text-center">Marj</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="py-4 px-4">
                      <div className="h-3 rounded bg-kp-bg-tertiary animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🏷️</span>
                    <p className="text-sm font-medium text-kp-text-secondary">Ürün bulunamadı</p>
                    <p className="text-xs text-kp-text-tertiary">
                      {filters.search || filters.status !== 'all' || filters.categoryId !== 'all' || filters.stockLevel !== 'all'
                        ? 'Filtreleri değiştirerek tekrar deneyin.'
                        : '"Ürün Ekle" butonuna tıklayarak ilk ürününüzü oluşturun.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => onRowClick(product)}
                  className="hover:bg-kp-bg-hover/40 transition-colors cursor-pointer group"
                >
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

                  {/* Product */}
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
                        title="Düzenle"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-kp-sm text-kp-text-tertiary hover:text-kp-danger hover:bg-kp-bg-hover transition-colors"
                        title="Sil"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && totalFiltered > 0 && (
        <div className="flex items-center justify-between border-t border-kp-border px-4 py-3">
          <p className="text-[11px] text-kp-text-tertiary">
            <span className="font-medium text-kp-text-secondary">{startIdx}–{endIdx}</span>
            {' '}/ {totalFiltered} ürün
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-kp-sm border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page = i + 1;
              if (totalPages > 7) {
                if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`flex h-7 w-7 items-center justify-center rounded-kp-sm text-[11px] font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-kp-accent text-white shadow-sm'
                      : 'border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-kp-sm border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
