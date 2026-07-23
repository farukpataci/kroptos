'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  TruckIcon,
  ReceiptRefundIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ListBulletIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Order } from '../hooks/useOrders';
import { OrderStatusBadge, PaymentStatusBadge, FulfillmentStatusBadge, SourceBadge } from './OrderStatusBadge';
import OrderTimeline from './OrderTimeline';
import CargoSimulationModal from './CargoSimulationModal';

interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => Promise<Order>;
  onCancel: (orderId: string) => Promise<Order>;
  onRefund: (orderId: string) => Promise<Order>;
  onShip: (orderId: string, trackingData: any) => Promise<void>;
  getOrderDetail: (orderId: string) => Promise<Order>;
  getIntegrationLogs: (orderId: string) => Promise<any[]>;
}

type DrawerTab = 'overview' | 'timeline' | 'integrations';

const TABS: { value: DrawerTab; labelKey: string; Icon: React.ComponentType<any> }[] = [
  { value: 'overview', labelKey: 'tabOverview', Icon: ListBulletIcon },
  { value: 'timeline', labelKey: 'tabTimeline', Icon: ClockIcon },
  { value: 'integrations', labelKey: 'tabIntegrations', Icon: LinkIcon },
];

export default function OrderDetailDrawer({
  orderId,
  onClose,
  onUpdateStatus,
  onCancel,
  onRefund,
  onShip,
  getOrderDetail,
  getIntegrationLogs,
}: OrderDetailDrawerProps) {
  const t = useTranslations('orders.detail');
  const tc = useTranslations('common');
  const [order, setOrder] = useState<Order | null>(null);
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setOrder(null);
    setError(null);
    setActionError(null);
    setActiveTab('overview');
    setIsLoading(true);

    Promise.all([getOrderDetail(orderId), getIntegrationLogs(orderId)])
      .then(([orderData, logs]) => {
        setOrder(orderData);
        setIntegrationLogs(logs);
      })
      .catch((err) => setError(err.message || t('loadFailed')))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  const handleAction = async (action: () => Promise<Order>) => {
    setIsActioning(true);
    setActionError(null);
    try {
      const updated = await action();
      setOrder(updated);
    } catch (err: any) {
      setActionError(err.message || t('actionFailed'));
    } finally {
      setIsActioning(false);
    }
  };

  const handleStatusChange = (status: string) => {
    if (!order) return;
    handleAction(() => onUpdateStatus(order.id, status));
  };

  const handleCancel = () => {
    if (!order || !confirm(t('cancelConfirm'))) return;
    handleAction(() => onCancel(order.id));
  };

  const handleRefund = () => {
    if (!order || !confirm(t('refundConfirm'))) return;
    handleAction(() => onRefund(order.id));
  };

  const handleCargoConfirm = async (orderId: string, trackingData: any) => {
    await onShip(orderId, trackingData);
    // Refresh order detail
    const updated = await getOrderDetail(orderId);
    setOrder(updated);
    setIsCargoModalOpen(false);
  };

  const currencySymbol = order?.currency === 'TRY' ? '₺' : order?.currency === 'USD' ? '$' : '€';

  if (!orderId) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-2xl bg-kp-bg-secondary border-l border-kp-border h-full flex flex-col shadow-kp-elevated animate-slide-in-right">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-kp-border bg-kp-bg-primary/40 flex-shrink-0">
            <div>
              {isLoading ? (
                <div className="space-y-1.5">
                  <div className="h-4 w-36 rounded bg-kp-bg-tertiary animate-pulse" />
                  <div className="h-3 w-48 rounded bg-kp-bg-tertiary animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-kp-text-primary font-mono">
                      {order?.orderNumber || '...'}
                    </h3>
                    {order && <SourceBadge source={order.source} />}
                  </div>
                  {order && (
                    <p className="text-[11px] text-kp-text-tertiary mt-0.5">
                      {new Date(order.createdAt).toLocaleString('tr-TR', {
                        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors mt-0.5"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Amount Banner */}
          {order && (
            <div className="flex items-center justify-between px-6 py-3 bg-kp-accent/5 border-b border-kp-border flex-shrink-0">
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={order.status} size="md" />
                <PaymentStatusBadge status={order.paymentStatus} size="md" />
                <FulfillmentStatusBadge status={order.fulfillmentStatus} size="md" />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-kp-text-tertiary">{t('totalAmount')}</p>
                <p className="text-lg font-bold text-kp-text-primary">
                  {currencySymbol}
                  {parseFloat(order.totalAmount.toString()).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-kp-border px-6 flex-shrink-0 bg-kp-bg-primary/20">
            {TABS.map(({ value, labelKey, Icon }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-medium border-b-2 transition-all ${
                  activeTab === value
                    ? 'border-kp-accent text-kp-accent'
                    : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(labelKey)}
                {value === 'integrations' && integrationLogs.length > 0 && (
                  <span className="rounded-full bg-kp-bg-tertiary px-1.5 text-[9px] font-bold text-kp-text-tertiary">
                    {integrationLogs.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <ArrowPathIcon className="h-6 w-6 text-kp-accent animate-spin" />
                <p className="text-xs text-kp-text-tertiary">{tc('loading')}</p>
              </div>
            )}

            {error && (
              <div className="m-6 flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {order && !isLoading && (
              <div className="p-6 space-y-6">
                {/* Action Error */}
                {actionError && (
                  <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                    {actionError}
                  </div>
                )}

                {/* ── OVERVIEW TAB ── */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Customer Info */}
                    <div>
                      <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">
                        {t('customerInfo')}
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('fullName')}</p>
                          <p className="font-semibold text-kp-text-primary mt-0.5">{order.customerName || '—'}</p>
                        </div>
                        <div>
                          <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('email')}</p>
                          <p className="text-kp-text-secondary mt-0.5">{order.customerEmail || '—'}</p>
                        </div>
                        <div>
                          <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('phone')}</p>
                          <p className="text-kp-text-secondary mt-0.5">{order.customerPhone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('shippingAddress')}</p>
                          <p className="text-kp-text-secondary mt-0.5">{order.shippingAddress || '—'}</p>
                        </div>
                        {order.notes && (
                          <div className="col-span-2">
                            <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('notes')}</p>
                            <p className="text-kp-text-secondary mt-0.5 bg-kp-bg-primary/40 rounded-kp-sm p-2 text-[11px]">
                              {order.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Line Items */}
                    <div>
                      <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">
                        {t('orderItems')}
                      </h4>
                      <div className="border border-kp-border rounded-kp-md overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-kp-bg-primary/40 text-[10px] font-semibold uppercase text-kp-text-tertiary border-b border-kp-border">
                            <tr>
                              <th className="py-2 px-3">{t('colProduct')}</th>
                              <th className="py-2 px-3">SKU</th>
                              <th className="py-2 px-3 text-center">{t('colQuantity')}</th>
                              <th className="py-2 px-3 text-right">{t('colTotal')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-2.5 px-3 font-medium text-kp-text-primary">{item.name}</td>
                                  <td className="py-2.5 px-3 font-mono text-[10px] text-kp-text-tertiary">{item.sku}</td>
                                  <td className="py-2.5 px-3 text-center font-medium">{item.quantity}</td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-kp-text-primary">
                                    {currencySymbol}
                                    {parseFloat(item.totalPrice.toString()).toLocaleString('tr-TR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-[11px] text-kp-text-tertiary">
                                  {t('noItems')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-3">
                        <div className="text-right">
                          <span className="text-xs text-kp-text-tertiary">{t('grandTotal')}: </span>
                          <span className="text-base font-bold text-kp-text-primary">
                            {currencySymbol}
                            {parseFloat(order.totalAmount.toString()).toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Actions */}
                    <div className="bg-kp-bg-primary/20 border border-kp-border rounded-kp-md p-4 space-y-3">
                      <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest">
                        {t('actionsTitle')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {/* Ship */}
                        {(order.status === 'pending' || order.status === 'processing') && (
                          <button
                            onClick={() => setIsCargoModalOpen(true)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            <TruckIcon className="h-3.5 w-3.5" />
                            {t('shipAction')}
                          </button>
                        )}

                        {/* Status Change Dropdown */}
                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <select
                            value=""
                            onChange={(e) => e.target.value && handleStatusChange(e.target.value)}
                            disabled={isActioning}
                            className="bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-medium focus:outline-none focus:border-kp-accent disabled:opacity-50"
                          >
                            <option value="" disabled>{t('changeStatus')}</option>
                            {order.status !== 'pending' && <option value="pending">{t('statusPending')}</option>}
                            {order.status !== 'processing' && <option value="processing">{t('statusProcessing')}</option>}
                            {order.status !== 'shipped' && <option value="shipped">{t('statusShipped')}</option>}
                            {order.status !== 'delivered' && <option value="delivered">{t('statusDelivered')}</option>}
                          </select>
                        )}

                        {/* Refund */}
                        {order.paymentStatus === 'paid' && (
                          <button
                            onClick={handleRefund}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 rounded-kp-md border border-kp-border text-kp-text-secondary hover:text-amber-400 hover:border-amber-400/30 px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <ReceiptRefundIcon className="h-3.5 w-3.5" />
                            {t('refundAction')}
                          </button>
                        )}

                        {/* Cancel */}
                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <button
                            onClick={handleCancel}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 rounded-kp-md border border-kp-border text-kp-text-secondary hover:text-kp-danger hover:border-kp-danger/30 px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <NoSymbolIcon className="h-3.5 w-3.5" />
                            {t('cancelAction')}
                          </button>
                        )}

                        {isActioning && (
                          <div className="flex items-center gap-1.5 text-xs text-kp-text-tertiary">
                            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                            {t('processing')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TIMELINE TAB ── */}
                {activeTab === 'timeline' && (
                  <OrderTimeline timeline={order.timeline || []} />
                )}

                {/* ── INTEGRATIONS TAB ── */}
                {activeTab === 'integrations' && (
                  <div>
                    {integrationLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                        <LinkIcon className="h-8 w-8 text-kp-text-tertiary" />
                        <p className="text-sm font-medium text-kp-text-secondary">{t('noIntegrationLogs')}</p>
                        <p className="text-xs text-kp-text-tertiary">{t('noIntegrationLogsDesc')}</p>
                      </div>
                    ) : (
                      <div className="border border-kp-border rounded-kp-md overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-kp-bg-primary/40 text-[10px] font-semibold uppercase text-kp-text-tertiary border-b border-kp-border">
                            <tr>
                              <th className="py-2 px-3">{t('logDate')}</th>
                              <th className="py-2 px-3">{t('logProvider')}</th>
                              <th className="py-2 px-3">{t('logOperation')}</th>
                              <th className="py-2 px-3">{t('logStatus')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                            {integrationLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="py-2.5 px-3 text-[10px]">
                                  {new Date(log.createdAt).toLocaleString('tr-TR')}
                                </td>
                                <td className="py-2.5 px-3 font-medium capitalize">{log.provider}</td>
                                <td className="py-2.5 px-3 text-[10px]">{log.operation}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                      log.status === 'success'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : log.status === 'failed'
                                        ? 'bg-red-500/10 text-red-400'
                                        : 'bg-blue-500/10 text-blue-400'
                                    }`}
                                  >
                                    {log.status?.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cargo Modal */}
      {isCargoModalOpen && order && (
        <CargoSimulationModal
          order={order}
          onClose={() => setIsCargoModalOpen(false)}
          onConfirm={handleCargoConfirm}
        />
      )}
    </>
  );
}
