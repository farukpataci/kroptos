'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
}

export interface OrderTimeline {
  id: string;
  eventType: string;
  oldValue?: string;
  newValue?: string;
  userId?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  /** Our own identifier, independent of the marketplace's number. Optional
   *  because rows imported before the sync worker started writing it have
   *  none until the backfill runs. */
  publicId?: string;
  storeId?: string;
  store?: { id: string; name: string; publicId?: string };
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  notes?: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  source: string;
  isPoolOrder?: boolean;
  logoSyncStatus?: string;
  totalAmount: string | number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  items?: OrderItem[];
  timeline?: OrderTimeline[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
}

export interface CreateOrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  source: string;
  currency: string;
  notes?: string;
  items: CreateOrderItem[];
}

export interface OrderFilters {
  search: string;
  status: string;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  sources?: string[];
  paymentStatuses?: string[];
  fulfillmentStatuses?: string[];
  carrier?: string;
  minAmount?: number | string;
  maxAmount?: number | string;
}

export function useOrders() {
  const t = useTranslations('orders');
  const { tenantContext } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: 'all',
    dateRange: 'all',
    startDate: undefined,
    endDate: undefined,
    sources: [],
    paymentStatuses: [],
    fulfillmentStatuses: [],
    carrier: '',
    minAmount: '',
    maxAmount: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchOrders = useCallback(async () => {
    if (!tenantContext.storeId && !tenantContext.agencyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Order[]>('/orders');
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message || t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext.storeId, tenantContext.agencyId]);

  const fetchProducts = useCallback(async () => {
    if (!tenantContext.storeId && !tenantContext.agencyId) return;
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(data || []);
    } catch (_) {}
  }, [tenantContext.storeId, tenantContext.agencyId]);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [fetchOrders, fetchProducts]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Client-side filtering
  const filteredOrders = orders.filter((order) => {
    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchesName = order.customerName?.toLowerCase().includes(q);
      const matchesNumber = order.orderNumber?.toLowerCase().includes(q);
      const matchesEmail = order.customerEmail?.toLowerCase().includes(q);
      const matchesPublicId = order.publicId?.toLowerCase().includes(q);
      const matchesPhone = order.customerPhone?.toLowerCase().includes(q);
      if (!matchesName && !matchesNumber && !matchesEmail && !matchesPublicId && !matchesPhone) return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'all' && order.status !== filters.status) {
      return false;
    }

    // Sources filter
    if (filters.sources && filters.sources.length > 0) {
      const orderSrc = (order.source || 'web').toLowerCase();
      if (!filters.sources.includes(orderSrc)) return false;
    }

    // Payment Statuses filter
    if (filters.paymentStatuses && filters.paymentStatuses.length > 0) {
      if (!filters.paymentStatuses.includes(order.paymentStatus)) return false;
    }

    // Fulfillment Statuses filter
    if (filters.fulfillmentStatuses && filters.fulfillmentStatuses.length > 0) {
      if (!filters.fulfillmentStatuses.includes(order.fulfillmentStatus)) return false;
    }

    // Amount range
    const amount = Number(order.totalAmount || 0);
    if (filters.minAmount !== undefined && filters.minAmount !== '' && amount < Number(filters.minAmount)) {
      return false;
    }
    if (filters.maxAmount !== undefined && filters.maxAmount !== '' && amount > Number(filters.maxAmount)) {
      return false;
    }

    // Date range filter
    if (filters.dateRange === 'custom') {
      const orderDate = new Date(order.createdAt).getTime();
      if (filters.startDate && orderDate < new Date(filters.startDate).getTime()) return false;
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end.getTime()) return false;
      }
    } else if (filters.dateRange && filters.dateRange !== 'all') {
      const days = parseInt(filters.dateRange, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(order.createdAt) < cutoff) return false;
    }

    return true;
  });

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Status counts for tab badges
  const statusCounts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Actions
  const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
    const created = await apiFetch<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setOrders((prev) => [created, ...prev]);
    return created;
  };

  const updateStatus = async (orderId: string, status: string): Promise<Order> => {
    const updated = await apiFetch<Order>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    return updated;
  };

  const cancelOrder = async (orderId: string): Promise<Order> => {
    const updated = await apiFetch<Order>(`/orders/${orderId}/cancel`, {
      method: 'POST',
    });
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    return updated;
  };

  const refundOrder = async (orderId: string): Promise<Order> => {
    const updated = await apiFetch<Order>(`/orders/${orderId}/refund`, {
      method: 'POST',
    });
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    return updated;
  };

  const getOrderDetail = async (orderId: string): Promise<Order> => {
    return apiFetch<Order>(`/orders/${orderId}`);
  };

  const getIntegrationLogs = async (orderId: string): Promise<any[]> => {
    try {
      const res = await apiFetch<any>(`/integration-logs?entityId=${orderId}`);
      return res?.items || [];
    } catch {
      return [];
    }
  };

  return {
    // Data
    orders: paginatedOrders,
    allOrders: orders,
    products,
    isLoading,
    error,

    // Filters
    filters,
    setFilters,
    statusCounts,
    totalFiltered: filteredOrders.length,

    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,

    // Actions
    fetchOrders,
    createOrder,
    updateStatus,
    cancelOrder,
    refundOrder,
    getOrderDetail,
    getIntegrationLogs,
  };
}
