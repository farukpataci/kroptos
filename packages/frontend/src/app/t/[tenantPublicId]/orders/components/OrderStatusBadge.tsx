'use client';

import { useTranslations } from 'next-intl';
import {
  ClockIcon,
  ArrowPathIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<
  string,
  { className: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  pending: {
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    Icon: ClockIcon,
  },
  processing: {
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    Icon: ArrowPathIcon,
  },
  shipped: {
    className: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    Icon: TruckIcon,
  },
  delivered: {
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    Icon: CheckCircleIcon,
  },
  cancelled: {
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    Icon: XCircleIcon,
  },
};

const paymentConfig: Record<string, { className: string }> = {
  pending: { className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  paid: { className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  refunded: { className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  failed: { className: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

const fulfillmentConfig: Record<string, { className: string }> = {
  unfulfilled: { className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
  partially_fulfilled: { className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  fulfilled: { className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  returned: { className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
};

export function OrderStatusBadge({ status, size = 'sm' }: OrderStatusBadgeProps) {
  const t = useTranslations('orders.status');
  const known = statusConfig[status];
  const config = known
    ? { label: t(status), ...known }
    : {
        label: status,
        className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
        Icon: ClockIcon,
      };
  const { label, className, Icon } = config;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const textSize = size === 'sm' ? 'text-[0.625rem]' : 'text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${className} ${textSize}`}
    >
      <Icon className={iconSize} />
      {label}
    </span>
  );
}

export function PaymentStatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const t = useTranslations('orders.paymentStatus');
  const known = paymentConfig[status];
  const config = known
    ? { label: t(status), className: known.className }
    : {
        label: status,
        className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
      };
  const textSize = size === 'sm' ? 'text-[0.625rem]' : 'text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${config.className} ${textSize}`}
    >
      {config.label}
    </span>
  );
}

export function FulfillmentStatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const t = useTranslations('orders.fulfillmentStatus');
  const known = fulfillmentConfig[status];
  const config = known
    ? { label: t(status), className: known.className }
    : {
        label: status,
        className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
      };
  const textSize = size === 'sm' ? 'text-[0.625rem]' : 'text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${config.className} ${textSize}`}
    >
      {config.label}
    </span>
  );
}

export function OrderModeBadge({ isPoolOrder, logoSyncStatus }: { isPoolOrder?: boolean; logoSyncStatus?: string }) {
  if (isPoolOrder || logoSyncStatus === 'BYPASSED_POOL') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[0.625rem] bg-purple-500/10 text-purple-400 border border-purple-500/20" title="KroptOS stok/operasyon havuzunda işleniyor (Logo ERP'ye kaydolmaz)">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
        Havuz Siparişi
      </span>
    );
  }

  if (logoSyncStatus === 'SYNCED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[0.625rem] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Logo ERP kayıtlı">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Logo Kayıtlı
      </span>
    );
  }

  if (logoSyncStatus === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[0.625rem] bg-red-500/10 text-red-400 border border-red-500/20">
        Logo Hatası
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[0.625rem] bg-blue-500/10 text-blue-400 border border-blue-500/20">
      Logo Bekliyor
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const t = useTranslations('orders');
  const sourceMap: Record<string, { label: string; className: string }> = {
    manual: { label: t('sourceManual'), className: 'bg-slate-500/10 text-slate-400' },
    trendyol: { label: 'Trendyol', className: 'bg-orange-500/10 text-orange-400' },
    hepsiburada: { label: 'Hepsiburada', className: 'bg-orange-600/10 text-orange-500' },
    shopify: { label: 'Shopify', className: 'bg-green-500/10 text-green-400' },
    n11: { label: 'N11', className: 'bg-purple-500/10 text-purple-400' },
  };
  const cfg = sourceMap[source] || { label: source, className: 'bg-slate-500/10 text-slate-400' };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
