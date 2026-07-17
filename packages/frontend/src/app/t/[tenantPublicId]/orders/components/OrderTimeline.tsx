'use client';

import { OrderTimeline as OrderTimelineType } from '../hooks/useOrders';

interface OrderTimelineProps {
  timeline: OrderTimelineType[];
}

const eventConfig: Record<string, { label: string; color: string; dot: string }> = {
  order_created: { label: 'Sipariş Oluşturuldu', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  status_changed: { label: 'Durum Değişti', color: 'text-blue-400', dot: 'bg-blue-500' },
  payment_status_changed: { label: 'Ödeme Durumu Değişti', color: 'text-amber-400', dot: 'bg-amber-500' },
  fulfillment_status_changed: { label: 'Karşılama Durumu Değişti', color: 'text-violet-400', dot: 'bg-violet-500' },
  order_cancelled: { label: 'Sipariş İptal Edildi', color: 'text-red-400', dot: 'bg-red-500' },
  order_refunded: { label: 'Ödeme İade Edildi', color: 'text-orange-400', dot: 'bg-orange-500' },
};

function formatValue(val?: string): string {
  if (!val) return '';
  const map: Record<string, string> = {
    pending: 'Beklemede',
    processing: 'İşlemde',
    shipped: 'Kargoda',
    delivered: 'Teslim',
    cancelled: 'İptal',
    paid: 'Ödendi',
    refunded: 'İade',
    unfulfilled: 'Karşılanmadı',
    partially_fulfilled: 'Kısmen Karşılandı',
    fulfilled: 'Karşılandı',
    returned: 'İade Edildi',
  };
  return map[val] || val;
}

export default function OrderTimeline({ timeline }: OrderTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-kp-text-tertiary">
        Henüz timeline kaydı yok.
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="space-y-0">
        {timeline.map((event, idx) => {
          const cfg = eventConfig[event.eventType] || {
            label: event.eventType,
            color: 'text-kp-text-secondary',
            dot: 'bg-kp-text-tertiary',
          };

          return (
            <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Connector line */}
              {idx !== timeline.length - 1 && (
                <span className="absolute left-[13px] top-7 h-full w-px bg-kp-border" />
              )}

              {/* Dot */}
              <div className="relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-kp-border bg-kp-bg-secondary">
                <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</p>
                {(event.oldValue || event.newValue) && (
                  <p className="mt-0.5 text-[11px] text-kp-text-secondary">
                    {event.oldValue && (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-kp-bg-primary text-kp-text-tertiary font-medium">
                        {formatValue(event.oldValue)}
                      </span>
                    )}
                    {event.oldValue && event.newValue && (
                      <span className="mx-1.5 text-kp-text-tertiary">→</span>
                    )}
                    {event.newValue && (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-kp-accent/10 text-kp-accent font-semibold">
                        {formatValue(event.newValue)}
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-kp-text-tertiary">
                  {new Date(event.createdAt).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
