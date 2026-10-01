'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  ShoppingCartIcon, 
  ArrowPathIcon, 
  ExclamationTriangleIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useOrders } from './hooks/useOrders';
import OrdersTable from './components/OrdersTable';
import OrderStatusSidebar from './components/OrderStatusSidebar';
import OrderDetailDrawer from './components/OrderDetailDrawer';
import CreateOrderModal from './components/CreateOrderModal';
import OrderFilterDrawer from './components/OrderFilterDrawer';

const DATE_OPTIONS = [
  { value: 'all', labelKey: 'dateOptions.all' },
  { value: '7', labelKey: 'dateOptions.last7' },
  { value: '30', labelKey: 'dateOptions.last30' },
  { value: '90', labelKey: 'dateOptions.last90' },
];

export default function OrdersPage() {
  const t = useTranslations('orders');
  const tc = useTranslations('common');
  const {
    orders,
    products,
    isLoading,
    error,
    filters,
    setFilters,
    statusCounts,
    totalFiltered,
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,
    fetchOrders,
    createOrder,
    updateStatus,
    cancelOrder,
    refundOrder,
    getOrderDetail,
    getIntegrationLogs,
  } = useOrders();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Compute active filters count
  const activeSources = filters.sources || [];
  const activePaymentStatuses = filters.paymentStatuses || [];
  const activeFulfillmentStatuses = filters.fulfillmentStatuses || [];
  const hasAmountFilter = (filters.minAmount !== undefined && filters.minAmount !== '') || (filters.maxAmount !== undefined && filters.maxAmount !== '');
  const hasCustomDate = filters.dateRange === 'custom' && Boolean(filters.startDate || filters.endDate);

  const activeFilterCount = 
    (filters.search ? 1 : 0) +
    activeSources.length +
    activePaymentStatuses.length +
    activeFulfillmentStatuses.length +
    (filters.carrier ? 1 : 0) +
    (hasAmountFilter ? 1 : 0) +
    (hasCustomDate || (filters.dateRange !== 'all' && filters.dateRange !== 'custom') ? 1 : 0);

  const clearAllFilters = () => {
    setFilters({
      ...filters,
      search: '',
      dateRange: 'all',
      startDate: undefined,
      endDate: undefined,
      sources: [],
      paymentStatuses: [],
      fulfillmentStatuses: [],
      carrier: undefined,
      minAmount: undefined,
      maxAmount: undefined,
    });
  };

  // Check store context (via loading done but still no store)
  const hasNoStore = !isLoading && !error && orders.length === 0 && !filters.search && filters.status === 'all' && filters.dateRange === 'all';

  // Handle ship (update status to shipped)
  const handleShip = async (orderId: string, trackingData: any) => {
    await updateStatus(orderId, 'shipped');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-kp-border pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <ShoppingCartIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">
              {t('subtitle')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kp-text-tertiary" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md pl-8 pr-4 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent transition-colors"
            />
          </div>

          {/* Date Filter Select */}
          <div className="flex items-center gap-1.5 bg-kp-bg-primary border border-kp-border rounded-kp-md px-2.5 py-1.5 text-xs text-kp-text-secondary">
            <FunnelIcon className="h-3.5 w-3.5 text-kp-text-tertiary flex-shrink-0" />
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="bg-transparent border-none text-xs text-kp-text-primary focus:outline-none cursor-pointer"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Gelişmiş Filtreler Butonu */}
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`flex items-center gap-2 rounded-kp-md border px-3 py-2 text-xs font-medium transition-colors ${
              activeFilterCount > 0
                ? 'border-kp-accent/60 bg-kp-accent/10 text-kp-accent hover:bg-kp-accent/20'
                : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
            }`}
            title="Kapsamlı Filtre Paneli"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            <span>Filtreler</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-kp-accent px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Yenile Button */}
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {tc('actions.refresh')}
          </button>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-kp-md border border-kp-border/60 bg-kp-bg-secondary/40 p-2.5 text-xs animate-fade-in">
          <div className="flex items-center gap-1.5 text-kp-text-tertiary font-medium mr-1">
            <FunnelIcon className="h-3.5 w-3.5" />
            <span>Aktif Filtreler:</span>
          </div>

          {/* Search chip */}
          {filters.search && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary">
              <span>Arama: <strong>&ldquo;{filters.search}&rdquo;</strong></span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, search: '' })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {/* Date chip */}
          {filters.dateRange !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary">
              <span>
                Tarih:{' '}
                {filters.dateRange === 'custom'
                  ? `${filters.startDate || '...'} / ${filters.endDate || '...'}`
                  : filters.dateRange === '1'
                  ? 'Bugün'
                  : filters.dateRange === '7'
                  ? 'Son 7 Gün'
                  : filters.dateRange === '30'
                  ? 'Son 30 Gün'
                  : filters.dateRange === '90'
                  ? 'Son 3 Ay'
                  : `${filters.dateRange} gün`}
              </span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, dateRange: 'all', startDate: undefined, endDate: undefined })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {/* Sources chips */}
          {activeSources.map((source) => (
            <span
              key={`source-${source}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary capitalize"
            >
              <span>Kanal: <strong>{source}</strong></span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, sources: activeSources.filter((s) => s !== source) })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Payment statuses chips */}
          {activePaymentStatuses.map((ps) => (
            <span
              key={`ps-${ps}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary"
            >
              <span>Ödeme: <strong>{ps}</strong></span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, paymentStatuses: activePaymentStatuses.filter((s) => s !== ps) })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Fulfillment statuses chips */}
          {activeFulfillmentStatuses.map((fs) => (
            <span
              key={`fs-${fs}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary"
            >
              <span>Karşılama: <strong>{fs}</strong></span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, fulfillmentStatuses: activeFulfillmentStatuses.filter((s) => s !== fs) })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Carrier chip */}
          {filters.carrier && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary">
              <span>Kargo: <strong>{filters.carrier}</strong></span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, carrier: undefined })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {/* Amount range chip */}
          {hasAmountFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-kp-bg-primary border border-kp-border px-2.5 py-1 text-xs text-kp-text-secondary">
              <span>Tutar: <strong>{filters.minAmount || '0'} - {filters.maxAmount || '∞'} ₺</strong></span>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, minAmount: undefined, maxAmount: undefined })}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                title="Kaldır"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}

          {/* Clear all button */}
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto text-xs text-kp-accent hover:underline font-medium px-2 py-0.5"
          >
            Tümünü Temizle
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-kp-danger">{t('loadFailed')}</p>
            <p className="text-xs text-kp-danger/80 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchOrders}
            className="text-xs font-medium text-kp-danger hover:underline"
          >
            {tc('actions.retry')}
          </button>
        </div>
      )}

      {/* Status Sidebar + Orders Table */}
      {!error && (
        <div className="card overflow-hidden p-0 flex flex-col lg:flex-row lg:items-stretch">
          <div className="w-full lg:w-60 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-kp-border">
            <OrderStatusSidebar
              filters={filters}
              statusCounts={statusCounts}
              onFilterChange={setFilters}
            />
          </div>

          <div className="min-w-0 flex-1">
            <OrdersTable
              orders={orders}
              isLoading={isLoading}
              filters={filters}
              totalFiltered={totalFiltered}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              onFilterChange={setFilters}
              onPageChange={setCurrentPage}
              onRowClick={(order) => setSelectedOrderId(order.id)}
              onCreateOrder={() => setIsCreateModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Order Detail Drawer */}
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdateStatus={updateStatus}
          onCancel={cancelOrder}
          onRefund={refundOrder}
          onShip={handleShip}
          getOrderDetail={getOrderDetail}
          getIntegrationLogs={getIntegrationLogs}
        />
      )}

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <CreateOrderModal
          products={products}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={async (payload) => { await createOrder(payload); }}
        />
      )}

      {/* Comprehensive Filter Drawer */}
      <OrderFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        orders={orders}
      />
    </div>
  );
}

