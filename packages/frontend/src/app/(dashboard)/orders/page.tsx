'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import {
  ShoppingCartIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckIcon,
  TruckIcon,
  ReceiptRefundIcon,
  NoSymbolIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';

const orderStatusColors: Record<string, string> = {
  pending: 'badge--accent',
  processing: 'badge--warning',
  shipped: 'badge--info',
  delivered: 'badge--success',
  cancelled: 'badge--danger',
};

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
}

interface OrderTimeline {
  id: string;
  eventType: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  source: string;
  totalAmount: string | number;
  currency: string;
  createdAt: string;
  items?: OrderItem[];
  timeline?: OrderTimeline[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
}

export default function OrdersPage() {
  const { tenantContext } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer States
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderIntegrationLogs, setOrderIntegrationLogs] = useState<any[]>([]);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Cargo Simulation Modal State
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false);
  const [cargoForm, setCargoForm] = useState({
    provider: 'yurtici',
    weight: '1.0',
    packageCount: '1',
  });
  const [isSimulatingCargo, setIsSimulatingCargo] = useState(false);

  // Create Order Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    productId: '',
    quantity: '1',
    source: 'manual',
    currency: 'TRY',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const fetchOrders = async () => {
    if (!tenantContext.agencyId || !tenantContext.storeId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Order[]>('/orders');
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!tenantContext.agencyId || !tenantContext.storeId) return;
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(data || []);
    } catch (_) {}
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [tenantContext.agencyId, tenantContext.storeId]);

  // Fetch Order Details when selectedOrderId changes
  useEffect(() => {
    const fetchOrderDetail = async () => {
      if (!selectedOrderId) return;
      setIsDrawerLoading(true);
      setDrawerError(null);
      try {
        const [data, logs] = await Promise.all([
          apiFetch<Order>(`/orders/${selectedOrderId}`),
          apiFetch<any>(`/integration-logs?entityId=${selectedOrderId}`).catch(() => ({ items: [] }))
        ]);
        setSelectedOrder(data);
        setOrderIntegrationLogs(logs?.items || []);
      } catch (err: any) {
        setDrawerError(err.message || 'Failed to fetch order details');
      } finally {
        setIsDrawerLoading(false);
      }
    };
    fetchOrderDetail();
  }, [selectedOrderId]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedOrder) return;
    try {
      const updated = await apiFetch<Order>(`/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setSelectedOrder(updated);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      const updated = await apiFetch<Order>(`/orders/${selectedOrder.id}/cancel`, {
        method: 'POST',
      });
      setSelectedOrder(updated);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order');
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder) return;
    if (!confirm('Are you sure you want to refund this order?')) return;
    try {
      const updated = await apiFetch<Order>(`/orders/${selectedOrder.id}/refund`, {
        method: 'POST',
      });
      setSelectedOrder(updated);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
    } catch (err: any) {
      alert(err.message || 'Failed to refund order');
    }
  };

  const handleCargoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSimulatingCargo(true);
    try {
      const updated = await apiFetch<Order>(`/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'shipped' }),
      });

      const shipment = {
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        provider: cargoForm.provider,
        weight: cargoForm.weight,
        packageCount: cargoForm.packageCount,
        trackingNumber: `KP-${cargoForm.provider.toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}`,
        shippedAt: new Date().toISOString(),
      };
      
      const existingShipments = JSON.parse(localStorage.getItem('simulated_shipments') || '[]');
      localStorage.setItem('simulated_shipments', JSON.stringify([shipment, ...existingShipments]));

      setSelectedOrder(updated);
      setOrders(orders.map(o => o.id === updated.id ? updated : o));
      setIsCargoModalOpen(false);
      alert(`Cargo shipment created successfully! Tracking code: ${shipment.trackingNumber}`);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate cargo shipment');
    } finally {
      setIsSimulatingCargo(false);
    }
  };

  const handleOpenCreateOrder = () => {
    setCreateForm({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      shippingAddress: '',
      productId: products[0]?.id || '',
      quantity: '1',
      source: 'manual',
      currency: 'TRY',
    });
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantContext.agencyId || !tenantContext.storeId) {
      setCreateError('Agency and Store context required');
      return;
    }
    if (!createForm.productId) {
      setCreateError('Please select at least one catalog product to order');
      return;
    }

    setCreateError(null);
    setIsCreatingOrder(true);

    const payload = {
      customerName: createForm.customerName,
      customerEmail: createForm.customerEmail || undefined,
      customerPhone: createForm.customerPhone || undefined,
      shippingAddress: createForm.shippingAddress || undefined,
      currency: createForm.currency,
      source: createForm.source,
      items: [
        {
          productId: createForm.productId,
          quantity: parseInt(createForm.quantity, 10),
        }
      ]
    };

    try {
      const created = await apiFetch<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setOrders([created, ...orders]);
      setIsCreateModalOpen(false);
      alert(`Order ${created.orderNumber} created successfully!`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create order');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  if (!tenantContext.storeId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ShoppingCartIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Store Context Required</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          Please choose an active store from the top context bar to manage customer orders.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Failed to load orders</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
        <button
          onClick={fetchOrders}
          className="mt-4 flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-medium text-white hover:bg-kp-accent-hover transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <ShoppingCartIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-kp-text-primary">Orders</h1>
            <p className="text-[13px] text-kp-text-tertiary">Track and process customer order lifecycle transactions</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreateOrder}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
        >
          <PlusIcon className="h-4 w-4" /> Create Order
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Fulfillment</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-kp-text-tertiary">
                    No orders recorded for this store context. Click "Create Order" to place one.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setSelectedOrder(null);
                    }}
                    className="hover:bg-kp-bg-hover/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-kp-text-primary">{order.orderNumber}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-medium text-kp-text-primary">{order.customerName || 'Walk-in'}</p>
                        <p className="text-[10px] text-kp-text-tertiary">{order.customerEmail || '-'}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`badge ${orderStatusColors[order.status] || 'badge--accent'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={
                          order.paymentStatus === 'paid'
                            ? 'active'
                            : order.paymentStatus === 'refunded'
                            ? 'warning'
                            : 'error'
                        }
                        label={order.paymentStatus}
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={
                          order.fulfillmentStatus === 'fulfilled'
                            ? 'active'
                            : order.fulfillmentStatus === 'partially_fulfilled'
                            ? 'warning'
                            : 'error'
                        }
                        label={order.fulfillmentStatus}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-kp-text-primary">
                      ₺{parseFloat(order.totalAmount.toString()).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-kp-text-tertiary">
                      {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="my-8 w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary">Create New Simulated Order</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateOrderSubmit}>
              <div className="p-6 space-y-4">
                {createError && (
                  <div className="flex gap-2 p-3 text-xs border rounded-kp-md bg-kp-danger/10 border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.customerName}
                      onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Customer Email
                    </label>
                    <input
                      type="email"
                      value={createForm.customerEmail}
                      onChange={(e) => setCreateForm({ ...createForm, customerEmail: e.target.value })}
                      placeholder="jane@example.com"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Customer Phone
                    </label>
                    <input
                      type="text"
                      value={createForm.customerPhone}
                      onChange={(e) => setCreateForm({ ...createForm, customerPhone: e.target.value })}
                      placeholder="+90 555 999 8877"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Shipping Address
                    </label>
                    <input
                      type="text"
                      value={createForm.shippingAddress}
                      onChange={(e) => setCreateForm({ ...createForm, shippingAddress: e.target.value })}
                      placeholder="e.g. Kadıköy, İstanbul"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2 border-t border-kp-border pt-4">
                    <h4 className="text-xs font-semibold text-kp-text-primary mb-3">Order Product Line</h4>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Select Catalog Item
                    </label>
                    {products.length === 0 ? (
                      <p className="text-xs text-kp-danger">No products available in this store context. Please create a product first.</p>
                    ) : (
                      <select
                        value={createForm.productId}
                        onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value })}
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      >
                        <option value="" disabled>Choose a product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) - ₺{p.price}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={createForm.quantity}
                      onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Source
                    </label>
                    <select
                      value={createForm.source}
                      onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="manual">Manual</option>
                      <option value="shopify">Shopify</option>
                      <option value="trendyol">Trendyol</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrder || products.length === 0}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {isCreatingOrder && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL SIDE DRAWER */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-kp-bg-secondary border-l border-kp-border h-full flex flex-col shadow-kp-elevated animate-slide-in-right">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-bg-primary/50">
              <div>
                <h3 className="text-sm font-semibold text-kp-text-primary">
                  Order Details: {selectedOrder ? selectedOrder.orderNumber : 'Loading...'}
                </h3>
                {selectedOrder && (
                  <p className="text-[10px] text-kp-text-tertiary mt-0.5">
                    Source: <span className="uppercase font-semibold">{selectedOrder.source}</span> • Sync date: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedOrder(null);
                }}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isDrawerLoading && (
                <div className="flex h-40 flex-col items-center justify-center">
                  <ArrowPathIcon className="h-6 w-6 text-kp-accent animate-spin" />
                  <p className="text-xs text-kp-text-tertiary mt-2">Fetching order payload...</p>
                </div>
              )}

              {drawerError && (
                <div className="flex gap-2 p-3 text-xs border rounded-kp-md bg-kp-danger/10 border-kp-danger/20 text-kp-danger">
                  <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>{drawerError}</span>
                </div>
              )}

              {selectedOrder && (
                <div className="space-y-6">
                  {/* Status Info Row */}
                  <div className="grid grid-cols-3 gap-4 bg-kp-bg-primary/30 border border-kp-border rounded-kp-md p-4">
                    <div>
                      <p className="text-[10px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Status</p>
                      <span className={`badge ${orderStatusColors[selectedOrder.status] || 'badge--accent'}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Payment</p>
                      <StatusBadge
                        status={
                          selectedOrder.paymentStatus === 'paid'
                            ? 'active'
                            : selectedOrder.paymentStatus === 'refunded'
                            ? 'warning'
                            : 'error'
                        }
                        label={selectedOrder.paymentStatus}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Fulfillment</p>
                      <StatusBadge
                        status={
                          selectedOrder.fulfillmentStatus === 'fulfilled'
                            ? 'active'
                            : selectedOrder.fulfillmentStatus === 'partially_fulfilled'
                            ? 'warning'
                            : 'error'
                        }
                        label={selectedOrder.fulfillmentStatus}
                      />
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div>
                    <h4 className="text-xs font-semibold text-kp-text-primary border-b border-kp-border pb-2 mb-3">Customer Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-theme-sm">
                      <div>
                        <p className="text-[10px] text-kp-text-tertiary uppercase tracking-wider">Full Name</p>
                        <p className="font-semibold text-kp-text-primary">{selectedOrder.customerName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-kp-text-tertiary uppercase tracking-wider">Email</p>
                        <p className="text-kp-text-secondary">{selectedOrder.customerEmail || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-kp-text-tertiary uppercase tracking-wider">Phone</p>
                        <p className="text-kp-text-secondary">{selectedOrder.customerPhone || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-kp-text-tertiary uppercase tracking-wider">Shipping Address</p>
                        <p className="text-kp-text-secondary">{selectedOrder.shippingAddress || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div>
                    <h4 className="text-xs font-semibold text-kp-text-primary border-b border-kp-border pb-2 mb-3">Line Items</h4>
                    <div className="border border-kp-border rounded-kp-md overflow-hidden">
                      <table className="w-full text-left text-theme-sm">
                        <thead className="bg-kp-bg-primary/40 text-[10px] font-semibold uppercase text-kp-text-tertiary border-b border-kp-border">
                          <tr>
                            <th className="py-2 px-3">Item Details</th>
                            <th className="py-2 px-3">SKU</th>
                            <th className="py-2 px-3 text-center">Qty</th>
                            <th className="py-2 px-3 text-right">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                          {selectedOrder.items && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-2.5 px-3 font-medium text-kp-text-primary">{item.name}</td>
                                <td className="py-2.5 px-3 font-mono text-xs">{item.sku}</td>
                                <td className="py-2.5 px-3 text-center font-medium">{item.quantity}</td>
                                <td className="py-2.5 px-3 text-right font-semibold text-kp-text-primary">
                                  ₺{parseFloat(item.totalPrice.toString()).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-xs text-kp-text-tertiary">
                                No items in this order payload.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end mt-4">
                      <div className="text-right">
                        <span className="text-xs text-kp-text-tertiary">Total Amount: </span>
                        <span className="text-base font-bold text-kp-text-primary">
                          ₺{parseFloat(selectedOrder.totalAmount.toString()).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Panel */}
                  <div className="bg-kp-bg-primary/20 border border-kp-border rounded-kp-md p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-kp-text-primary">Order Actions</h4>
                    
                    <div className="flex flex-wrap gap-2">
                      {/* Cargo Simulation Trigger */}
                      {(selectedOrder.status === 'pending' || selectedOrder.status === 'processing') && (
                        <button
                          onClick={() => setIsCargoModalOpen(true)}
                          className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-2 text-xs font-semibold shadow-sm transition-all"
                        >
                          <TruckIcon className="h-4 w-4" /> Simulate Cargo Shipment
                        </button>
                      )}

                      {/* Status Update Trigger */}
                      {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleUpdateStatus(e.target.value)}
                          className="bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-semibold focus:outline-hidden focus:border-kp-accent"
                        >
                          <option value="" disabled>Change Status</option>
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      )}

                      {/* Refund Trigger */}
                      {selectedOrder.paymentStatus === 'paid' && (
                        <button
                          onClick={handleRefundOrder}
                          className="flex items-center gap-1.5 rounded-kp-md border border-kp-border text-kp-text-secondary hover:text-kp-warning px-3 py-2 text-xs font-semibold hover:bg-kp-bg-hover transition-colors"
                        >
                          <ReceiptRefundIcon className="h-4 w-4" /> Refund Order
                        </button>
                      )}

                      {/* Cancel Trigger */}
                      {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                        <button
                          onClick={handleCancelOrder}
                          className="flex items-center gap-1.5 rounded-kp-md border border-kp-border text-kp-text-secondary hover:text-kp-danger px-3 py-2 text-xs font-semibold hover:bg-kp-bg-hover transition-colors"
                        >
                          <NoSymbolIcon className="h-4 w-4" /> Cancel Order
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order Timeline */}
                  <div>
                    <h4 className="text-xs font-semibold text-kp-text-primary border-b border-kp-border pb-2 mb-3">Order History Timeline</h4>
                    <div className="flow-root">
                      <ul className="-mb-8">
                        {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? (
                          selectedOrder.timeline.map((event, idx) => (
                            <li key={event.id}>
                              <div className="relative pb-8">
                                {idx !== selectedOrder.timeline!.length - 1 && (
                                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-kp-border" aria-hidden="true" />
                                )}
                                <div className="relative flex space-x-3">
                                  <div>
                                    <span className="h-8 w-8 rounded-full bg-kp-bg-primary/80 border border-kp-border flex items-center justify-center text-kp-accent font-semibold text-xs">
                                      {idx + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 pt-1.5">
                                    <p className="text-xs text-kp-text-secondary">
                                      <span className="font-semibold text-kp-text-primary uppercase">{event.eventType}</span>
                                      {event.newValue && (
                                        <span> changed to <span className="font-semibold text-kp-accent">{event.newValue}</span></span>
                                      )}
                                    </p>
                                    <p className="text-[10px] text-kp-text-tertiary mt-0.5">
                                      {new Date(event.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="py-4 text-center text-xs text-kp-text-tertiary">
                            No timeline events recorded.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Integration History */}
                  <div className="mt-8">
                    <h4 className="text-xs font-semibold text-kp-text-primary border-b border-kp-border pb-2 mb-3">Integration History</h4>
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
                          {orderIntegrationLogs && orderIntegrationLogs.length > 0 ? (
                            orderIntegrationLogs.map((log) => (
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
                                No integration logs found for this order.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CARGO SIMULATION MODAL */}
      {isCargoModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-kp-accent animate-pulse" /> Simulate Cargo Shipment
              </h3>
              <button
                onClick={() => setIsCargoModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCargoSubmit}>
              <div className="p-6 space-y-4">
                <p className="text-xs text-kp-text-secondary">
                  Create a simulated shipment for order <span className="font-semibold text-kp-text-primary">{selectedOrder.orderNumber}</span>. This will set status to <span className="font-semibold text-kp-accent">shipped</span> and save tracking parameters.
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                    Cargo Provider / Carrier
                  </label>
                  <select
                    value={cargoForm.provider}
                    onChange={(e) => setCargoForm({ ...cargoForm, provider: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  >
                    <option value="yurtici">Yurtiçi Kargo</option>
                    <option value="mng">MNG Kargo</option>
                    <option value="dhl">DHL Express</option>
                    <option value="ups">UPS Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                    Total Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cargoForm.weight}
                    onChange={(e) => setCargoForm({ ...cargoForm, weight: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                    Package Count / Desi
                  </label>
                  <input
                    type="number"
                    required
                    value={cargoForm.packageCount}
                    onChange={(e) => setCargoForm({ ...cargoForm, packageCount: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
                <button
                  type="button"
                  onClick={() => setIsCargoModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulatingCargo}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
                >
                  {isSimulatingCargo && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Create Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
