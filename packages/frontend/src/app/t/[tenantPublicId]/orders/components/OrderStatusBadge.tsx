'use client';

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
  { label: string; className: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  pending: {
    label: 'Beklemede',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    Icon: ClockIcon,
  },
  processing: {
    label: 'İşlemde',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    Icon: ArrowPathIcon,
  },
  shipped: {
    label: 'Kargoda',
    className: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    Icon: TruckIcon,
  },
  delivered: {
    label: 'Teslim',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    Icon: CheckCircleIcon,
  },
  cancelled: {
    label: 'İptal',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    Icon: XCircleIcon,
  },
};

const paymentConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Bekliyor', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  paid: { label: 'Ödendi', className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  refunded: { label: 'İade', className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  failed: { label: 'Başarısız', className: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

const fulfillmentConfig: Record<string, { label: string; className: string }> = {
  unfulfilled: { label: 'Karşılanmadı', className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
  partially_fulfilled: { label: 'Kısmen', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  fulfilled: { label: 'Karşılandı', className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  returned: { label: 'İade', className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
};

export function OrderStatusBadge({ status, size = 'sm' }: OrderStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    Icon: ClockIcon,
  };
  const { label, className, Icon } = config;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

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
  const config = paymentConfig[status] || {
    label: status,
    className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  };
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${config.className} ${textSize}`}
    >
      {config.label}
    </span>
  );
}

export function FulfillmentStatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const config = fulfillmentConfig[status] || {
    label: status,
    className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  };
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${config.className} ${textSize}`}
    >
      {config.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const sourceMap: Record<string, { label: string; className: string }> = {
    manual: { label: 'Manuel', className: 'bg-slate-500/10 text-slate-400' },
    trendyol: { label: 'Trendyol', className: 'bg-orange-500/10 text-orange-400' },
    hepsiburada: { label: 'Hepsiburada', className: 'bg-orange-600/10 text-orange-500' },
    shopify: { label: 'Shopify', className: 'bg-green-500/10 text-green-400' },
    n11: { label: 'N11', className: 'bg-purple-500/10 text-purple-400' },
  };
  const cfg = sourceMap[source] || { label: source, className: 'bg-slate-500/10 text-slate-400' };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
