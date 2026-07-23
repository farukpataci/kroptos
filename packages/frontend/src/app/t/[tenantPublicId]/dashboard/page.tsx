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

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';

const orderStatusColors: Record<string, string> = {
  pending: 'badge--accent',
  processing: 'badge--warning',
  shipped: 'badge--info',
  delivered: 'badge--success',
  cancelled: 'badge--danger',
};

export default function DashboardPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('dashboard');
  const toast = useToast();
  const tenantPublicId = (params?.tenantPublicId as string) || '';
  const basePrefix = tenantPublicId ? `/t/${tenantPublicId}` : '';

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
    toast.info(t('syncStarted'));
    try {
      await Promise.all(
        integrations.map((integration) =>
          apiFetch(`/integrations/${integration.id}/test-connection`, { method: 'POST' }).catch(() => null)
        )
      );
      const integrationsList = await apiFetch<any[]>('/integrations');
      setIntegrations(integrationsList || []);
      toast.success(t('syncSuccess'));
    } catch (_) {
      toast.error(t('syncError'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportReports = () => {
    try {
      const reportHeaders = [t('export.customer'), t('export.date'), t('export.amount'), t('export.status')];
      const reportRows = orders.map((o) => [
        `"${(o.customerName || t('walkInCustomer')).replace(/"/g, '""')}"`,
        `"${new Date(o.createdAt).toLocaleDateString('tr-TR')}"`,
        `"${o.totalAmount || 0}"`,
        `"${o.status || ''}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [reportHeaders.join(','), ...reportRows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `kroptos_dashboard_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t('exportSuccess'));
    } catch (err: any) {
      toast.error(t('exportError'));
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
        <p className="mt-2 text-xs text-kp-text-tertiary">{t('loadingMetrics')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">{t('loadFailed')}</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">{t('title')}</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">
          {t('subtitle')}
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="stagger-1 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title={t('kpi.todaysOrders')}
            value={orders.length.toString()}
            trend={t('kpi.trendLive')}
            trendDirection="up"
            icon={<ShoppingCartIcon />}
            color="accent"
            href={`${basePrefix}/orders`}
          />
        </div>
        <div className="stagger-2 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title={t('kpi.revenue')}
            value={`₺${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`}
            trend={t('kpi.trendTotal')}
            trendDirection="up"
            icon={<CurrencyDollarIcon />}
            color="success"
            href={`${basePrefix}/orders`}
          />
        </div>
        <div className="stagger-3 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title={t('kpi.pendingShipments')}
            value={pendingShipments.toString()}
            trend={t('kpi.trendUnfulfilled')}
            trendDirection={pendingShipments > 0 ? 'up' : 'down'}
            icon={<TruckIcon />}
            color="warning"
            href={`${basePrefix}/orders`}
          />
        </div>
        <div className="stagger-4 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title={t('kpi.failedIntegrations')}
            value={failedIntegrations.toString()}
            trend={t('kpi.trendAttention')}
            trendDirection={failedIntegrations > 0 ? 'up' : 'down'}
            icon={<ExclamationTriangleIcon />}
            color="danger"
            href={`${basePrefix}/integrations`}
          />
        </div>
        <div className="stagger-5 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title={t('kpi.productsCatalog')}
            value={products.length.toString()}
            trend={t('kpi.trendActive')}
            trendDirection="up"
            icon={<ServerStackIcon />}
            color="info"
            href={`${basePrefix}/products`}
          />
        </div>
        <div className="stagger-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
          <KpiCard
            title={t('kpi.activeIntegrations')}
            value={integrations.length.toString()}
            trend={t('kpi.trendConnected')}
            trendDirection="up"
            icon={<BuildingOffice2Icon />}
            color="success"
            href={`${basePrefix}/integrations`}
          />
        </div>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Integration Health Center */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-kp-border pb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-kp-text-primary">{t('integrationHealth.title')}</h2>
              <p className="text-[11px] text-kp-text-tertiary">{t('integrationHealth.subtitle')}</p>
            </div>
          </div>
          <div className="divide-y divide-kp-border">
            {integrations.length === 0 ? (
              <div className="py-8 text-center text-xs text-kp-text-tertiary">
                {t('integrationHealth.none')}
              </div>
            ) : (
              integrations.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-bg-secondary border border-kp-border font-semibold text-xs text-kp-accent">
                      {item.platform?.slice(0, 2).toUpperCase() || 'INT'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-kp-text-primary">{item.name}</p>
                      <p className="text-[11px] text-kp-text-tertiary">
                        {item.platform} • {t('integrationHealth.lastSync')}: {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleTimeString() : t('integrationHealth.never')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${item.status === 'active' || item.status === 'connected' ? 'badge--success' : 'badge--danger'}`}>
                      {item.status}
                    </span>
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
              <h2 className="text-[15px] font-semibold text-kp-text-primary">{t('orderFeed.title')}</h2>
              <p className="text-[11px] text-kp-text-tertiary">{t('orderFeed.subtitle')}</p>
            </div>
          </div>
          <div className="divide-y divide-kp-border">
            {orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-kp-text-tertiary">
                {t('orderFeed.none')}
              </div>
            ) : (
              orders.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-xs font-semibold text-kp-text-primary font-mono">{item.orderNumber}</p>
                    <p className="text-[11px] text-kp-text-tertiary">
                      {item.customerName || t('walkInCustomer')} • {new Date(item.createdAt).toLocaleTimeString()}
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
          {t('quickActions.title')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <QuickActionCard
            label={t('quickActions.newOrder')}
            icon={<PlusIcon />}
            onClick={() => router.push(`${basePrefix}/orders`)}
          />
          <QuickActionCard
            label={t('quickActions.addProduct')}
            icon={<TagIcon />}
            onClick={() => router.push(`${basePrefix}/products`)}
          />
          <QuickActionCard
            label={isSyncing ? t('quickActions.syncing') : t('quickActions.syncChannels')}
            icon={<ArrowPathIcon className={isSyncing ? 'animate-spin' : ''} />}
            onClick={handleSyncAll}
          />
          <QuickActionCard
            label={t('quickActions.exportReports')}
            icon={<DocumentArrowDownIcon />}
            onClick={handleExportReports}
          />
          <QuickActionCard
            label={t('quickActions.auditTrail')}
            icon={<ClipboardDocumentListIcon />}
            onClick={() => router.push(`${basePrefix}/system/settings`)}
          />
        </div>
      </div>
    </div>
  );
}
