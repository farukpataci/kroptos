'use client';

import { useEffect, useState } from 'react';
import KpiCard from '@/components/ui/KpiCard';
import StatusBadge from '@/components/ui/StatusBadge';
import QuickActionCard from '@/components/ui/QuickActionCard';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  BuildingOffice2Icon,
  PlusIcon,
  TagIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const orderStatusColors: Record<string, string> = {
  pending: 'badge--accent',
  processing: 'badge--warning',
  shipped: 'badge--info',
  delivered: 'badge--success',
  cancelled: 'badge--danger',
};

export default function DashboardPage() {
  const { tenantContext } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!tenantContext.agencyId || !tenantContext.storeId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);

      try {
        const [ordersList, productsList, integrationsList] = await Promise.all([
          apiFetch<any[]>('/orders'),
          apiFetch<any[]>('/products'),
          apiFetch<any[]>('/integrations'),
        ]);

        setOrders(ordersList || []);
        setProducts(productsList || []);
        setIntegrations(integrationsList || []);
      } catch (err: any) {
        console.error('Failed to load dashboard metrics:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [tenantContext.agencyId, tenantContext.storeId]);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      // Simulate sync trigger or trigger integration health tests
      await Promise.all(
        integrations.map((integration) =>
          apiFetch(`/integrations/${integration.id}/test-connection`, { method: 'POST' }).catch(() => null)
        )
      );
      // Reload integrations status
      const integrationsList = await apiFetch<any[]>('/integrations');
      setIntegrations(integrationsList || []);
    } catch (_) {
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper calculation logic
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
  const pendingShipments = orders.filter((o) => o.fulfillmentStatus === 'unfulfilled').length;
  const failedIntegrations = integrations.filter((i) => i.status === 'error' || i.status === 'failed').length;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Failed to load Dashboard</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Operations Dashboard</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">
          Real-time overview of your commerce operations
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="stagger-1 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title="Today's Orders"
            value={orders.length.toString()}
            trend="Live"
            trendDirection="up"
            icon={<ShoppingCartIcon />}
            color="accent"
          />
        </div>
        <div className="stagger-2 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title="Revenue"
            value={`₺${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`}
            trend="Total"
            trendDirection="up"
            icon={<CurrencyDollarIcon />}
            color="success"
          />
        </div>
        <div className="stagger-3 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title="Pending Shipments"
            value={pendingShipments.toString()}
            trend="Unfulfilled"
            trendDirection={pendingShipments > 0 ? 'up' : 'down'}
            icon={<TruckIcon />}
            color="warning"
          />
        </div>
        <div className="stagger-4 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title="Failed Integrations"
            value={failedIntegrations.toString()}
            trend="Attention"
            trendDirection={failedIntegrations > 0 ? 'up' : 'down'}
            icon={<ExclamationTriangleIcon />}
            color="danger"
          />
        </div>
        <div className="stagger-5 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title="Products Catalog"
            value={products.length.toString()}
            trend="Active"
            trendDirection="up"
            icon={<ServerStackIcon />}
            color="info"
          />
        </div>
        <div className="stagger-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title="Active Integrations"
            value={integrations.length.toString()}
            trend="Connected"
            trendDirection="up"
            icon={<BuildingOffice2Icon />}
            color="success"
          />
        </div>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Integration Health Center */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-kp-border pb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-kp-text-primary">Integration Health Center</h2>
              <p className="text-[11px] text-kp-text-tertiary">Real-time status of your connected systems</p>
            </div>
          </div>
          <div className="divide-y divide-kp-border">
            {integrations.length === 0 ? (
              <p className="py-4 text-center text-xs text-kp-text-tertiary">No integrations configured yet.</p>
            ) : (
              integrations.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`status-dot status-dot--${
                        item.status === 'error' || item.status === 'failed'
                          ? 'error'
                          : item.status === 'warning'
                          ? 'warning'
                          : 'active'
                      }`}
                    />
                    <div>
                      <p className="text-[13px] font-medium text-kp-text-primary">{item.name}</p>
                      <p className="text-[10px] text-kp-text-tertiary uppercase tracking-wide">
                        {item.provider} • {item.providerType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge
                      status={
                        item.status === 'error' || item.status === 'failed'
                          ? 'error'
                          : item.status === 'warning'
                          ? 'warning'
                          : 'active'
                      }
                      label={item.status === 'error' || item.status === 'failed' ? 'Failed' : 'Connected'}
                    />
                    <p className="mt-1 text-[10px] text-kp-text-tertiary">
                      Sync: {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleTimeString() : 'Never'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Live Order Feed */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-kp-border pb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-kp-text-primary">Live Order Feed</h2>
              <p className="text-[11px] text-kp-text-tertiary">Most recent orders across storefronts</p>
            </div>
          </div>
          <div className="divide-y divide-kp-border">
            {orders.length === 0 ? (
              <p className="py-4 text-center text-xs text-kp-text-tertiary">No orders recorded yet.</p>
            ) : (
              orders.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[13px] font-mono font-medium text-kp-text-primary">{item.orderNumber}</p>
                    <p className="text-[11px] text-kp-text-tertiary">
                      {item.customerName || 'Walk-in Customer'} • {new Date(item.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-semibold text-kp-text-primary">
                      ₺{parseFloat(item.totalAmount).toLocaleString()}
                    </span>
                    <div className="mt-1">
                      <span className={`badge ${orderStatusColors[item.status] || 'badge--accent'}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="card space-y-4">
        <h2 className="text-[15px] font-semibold text-kp-text-primary border-b border-kp-border pb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <QuickActionCard
            label="New Order"
            icon={<PlusIcon />}
            onClick={() => (window.location.href = '/orders')}
          />
          <QuickActionCard
            label="Add Product"
            icon={<TagIcon />}
            onClick={() => (window.location.href = '/products')}
          />
          <QuickActionCard
            label={isSyncing ? 'Syncing...' : 'Sync Channels'}
            icon={<ArrowPathIcon className={isSyncing ? 'animate-spin' : ''} />}
            onClick={handleSyncAll}
          />
          <QuickActionCard
            label="Export Reports"
            icon={<DocumentArrowDownIcon />}
            onClick={() => {}}
          />
          <QuickActionCard
            label="Audit Trail"
            icon={<ClipboardDocumentListIcon />}
            onClick={() => (window.location.href = '/audit-logs')}
          />
        </div>
      </div>
    </div>
  );
}
