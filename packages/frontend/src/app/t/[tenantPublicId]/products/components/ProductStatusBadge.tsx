'use client';

import { useTranslations } from 'next-intl';

interface ProductStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { labelKey: string; className: string }> = {
  active: {
    labelKey: 'active',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  draft: {
    labelKey: 'draft',
    className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  },
  suspended: {
    labelKey: 'suspended',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
};

export function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  const t = useTranslations('products.status');
  const known = statusConfig[status];
  const cfg = known
    ? { label: t(known.labelKey), className: known.className }
    : {
        label: status,
        className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
      };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

interface StockBadgeProps {
  quantity: number;
  threshold?: number;
}

export function StockBadge({ quantity, threshold = 10 }: StockBadgeProps) {
  const t = useTranslations('products.stock');
  if (quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        {t('outOfStock')}
      </span>
    );
  }
  if (quantity <= threshold) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-amber-400 text-xs">{quantity}</span>
        <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {t('lowStock')}
        </span>
      </div>
    );
  }
  return (
    <span className="font-medium text-kp-text-secondary text-xs">{quantity}</span>
  );
}

interface MarginBadgeProps {
  price: number;
  costPrice?: number;
}

export function MarginBadge({ price, costPrice }: MarginBadgeProps) {
  if (!costPrice || costPrice <= 0 || price <= 0) return <span className="text-kp-text-tertiary text-[0.625rem]">—</span>;
  const margin = ((price - costPrice) / price) * 100;
  const isGood = margin >= 30;
  const isMid = margin >= 15;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-bold ${
        isGood
          ? 'bg-emerald-500/10 text-emerald-400'
          : isMid
          ? 'bg-amber-500/10 text-amber-400'
          : 'bg-red-500/10 text-red-400'
      }`}
    >
      %{margin.toFixed(1)}
    </span>
  );
}

export function getProductImage(imageStr?: string | null): string {
  if (!imageStr) return '';
  if (imageStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(imageStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (_) {}
  }
  return imageStr;
}

