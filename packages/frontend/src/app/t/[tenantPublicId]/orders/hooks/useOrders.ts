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
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchOrders = useCallback(async () => {
    if (!tenantContext.storeId) {
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
  }, [tenantContext.storeId]);

  const fetchProducts = useCallback(async () => {
    if (!tenantContext.storeId) return;
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(data || []);
    } catch (_) {}
  }, [tenantContext.storeId]);

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
      if (!matchesName && !matchesNumber && !matchesEmail) return false;
    }

    // Status filter
    if (filters.status !== 'all' && order.status !== filters.status) {
      return false;
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
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
