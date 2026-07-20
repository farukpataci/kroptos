'use client';

import { useState } from 'react';
import { ShoppingCartIcon, ArrowPathIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useOrders } from './hooks/useOrders';
import OrdersTable from './components/OrdersTable';
import OrderStatusSidebar from './components/OrderStatusSidebar';
import OrderDetailDrawer from './components/OrderDetailDrawer';
import CreateOrderModal from './components/CreateOrderModal';

const DATE_OPTIONS = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: '7', label: 'Son 7 Gün' },
  { value: '30', label: 'Son 30 Gün' },
  { value: '90', label: 'Son 90 Gün' },
];

export default function OrdersPage() {
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
            <h1 className="text-xl font-semibold text-kp-text-primary">Siparişler</h1>
            <p className="text-[13px] text-kp-text-tertiary">
              Müşteri siparişlerini takip edin ve yönetin
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
              placeholder="Sipariş no veya müşteri adı..."
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
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Yenile Button */}
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>


      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-kp-danger">Siparişler yüklenemedi</p>
            <p className="text-xs text-kp-danger/80 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchOrders}
            className="text-xs font-medium text-kp-danger hover:underline"
          >
            Tekrar dene
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
    </div>
  );
}
