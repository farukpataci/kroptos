'use client';

import { MagnifyingGlassIcon, FunnelIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Order, OrderFilters } from '../hooks/useOrders';
import { OrderStatusBadge, PaymentStatusBadge, FulfillmentStatusBadge, SourceBadge } from './OrderStatusBadge';

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  filters: OrderFilters;
  statusCounts: Record<string, number>;
  totalFiltered: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onFilterChange: (filters: OrderFilters) => void;
  onPageChange: (page: number) => void;
  onRowClick: (order: Order) => void;
  onCreateOrder: () => void;
}

const STATUS_TABS = [
  { value: 'all', label: 'Tümü' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'processing', label: 'İşlemde' },
  { value: 'shipped', label: 'Kargoda' },
  { value: 'delivered', label: 'Teslim' },
  { value: 'cancelled', label: 'İptal' },
];

const DATE_OPTIONS = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: '7', label: 'Son 7 Gün' },
  { value: '30', label: 'Son 30 Gün' },
  { value: '90', label: 'Son 90 Gün' },
];

export default function OrdersTable({
  orders,
  isLoading,
  filters,
  statusCounts,
  totalFiltered,
  currentPage,
  totalPages,
  pageSize,
  onFilterChange,
  onPageChange,
  onRowClick,
  onCreateOrder,
}: OrdersTableProps) {
  const totalOnPage = orders.length;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(startIdx + totalOnPage - 1, totalFiltered);

  return (
    <div className="card overflow-hidden">
      {/* Filter Bar */}
      <div className="border-b border-kp-border">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === 'all'
                ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                : statusCounts[tab.value] || 0;
            const isActive = filters.status === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onFilterChange({ ...filters, status: tab.value })}
                className={`
                  flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-[12px] font-medium transition-all border-b-2
                  ${isActive
                    ? 'border-kp-accent text-kp-accent'
                    : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
                  }
                `}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive
                        ? 'bg-kp-accent/15 text-kp-accent'
                        : 'bg-kp-bg-tertiary text-kp-text-tertiary'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + Date Filter */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kp-text-tertiary" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              placeholder="Sipariş no veya müşteri adı..."
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md pl-8 pr-4 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <FunnelIcon className="h-3.5 w-3.5 text-kp-text-tertiary flex-shrink-0" />
            <select
              value={filters.dateRange}
              onChange={(e) => onFilterChange({ ...filters, dateRange: e.target.value })}
              className="bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto">
            <button
              onClick={onCreateOrder}
              className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
            >
              <span className="text-base leading-none">+</span>
              Sipariş Oluştur
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[10px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4">Sipariş No</th>
              <th className="py-3 px-4">Müşteri</th>
              <th className="py-3 px-4">Kaynak</th>
              <th className="py-3 px-4">Sipariş Durumu</th>
              <th className="py-3 px-4">Ödeme</th>
              <th className="py-3 px-4">Karşılama</th>
              <th className="py-3 px-4 text-right">Tutar</th>
              <th className="py-3 px-4">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="py-4 px-4">
                      <div className="h-3 rounded bg-kp-bg-tertiary animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📦</span>
                    <p className="text-sm font-medium text-kp-text-secondary">Sipariş bulunamadı</p>
                    <p className="text-xs text-kp-text-tertiary">
                      {filters.search || filters.status !== 'all' || filters.dateRange !== 'all'
                        ? 'Filtreleri değiştirerek tekrar deneyin.'
                        : 'İlk siparişi oluşturmak için "Sipariş Oluştur" butonuna tıklayın.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onRowClick(order)}
                  className="hover:bg-kp-bg-hover/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                      {order.orderNumber}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-medium text-kp-text-primary text-[12px]">
                        {order.customerName || 'Walk-in'}
                      </p>
                      {order.customerEmail && (
                        <p className="text-[10px] text-kp-text-tertiary">{order.customerEmail}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <SourceBadge source={order.source} />
                  </td>
                  <td className="py-3.5 px-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="py-3.5 px-4">
                    <FulfillmentStatusBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-semibold text-kp-text-primary text-[12px]">
                      {order.currency === 'TRY' ? '₺' : order.currency === 'USD' ? '$' : '€'}
                      {parseFloat(order.totalAmount.toString()).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="text-[11px] text-kp-text-secondary">
                        {new Date(order.createdAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-[10px] text-kp-text-tertiary">
                        {new Date(order.createdAt).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
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
            {' '}/ {totalFiltered} sipariş
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-kp-sm border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                      : 'border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-kp-sm border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
