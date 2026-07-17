'use client';

import { useState } from 'react';
import { XMarkIcon, TruckIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Order } from '../hooks/useOrders';

interface CargoSimulationModalProps {
  order: Order;
  onClose: () => void;
  onConfirm: (orderId: string, trackingData: CargoTrackingData) => Promise<void>;
}

export interface CargoTrackingData {
  provider: string;
  trackingNumber: string;
  weight: string;
  packageCount: string;
}

const PROVIDERS = [
  { value: 'yurtici', label: 'Yurtiçi Kargo' },
  { value: 'mng', label: 'MNG Kargo' },
  { value: 'aras', label: 'Aras Kargo' },
  { value: 'surat', label: 'Sürat Kargo' },
  { value: 'dhl', label: 'DHL Express' },
  { value: 'ups', label: 'UPS Shipping' },
  { value: 'ptt', label: 'PTT Kargo' },
];

export default function CargoSimulationModal({ order, onClose, onConfirm }: CargoSimulationModalProps) {
  const [form, setForm] = useState({
    provider: 'yurtici',
    weight: '1.0',
    packageCount: '1',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingResult, setTrackingResult] = useState<string | null>(null);

  const generateTrackingNumber = (provider: string) => {
    const prefix = provider.slice(0, 3).toUpperCase();
    const random = Math.floor(10000000 + Math.random() * 90000000);
    return `KP-${prefix}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const trackingNumber = generateTrackingNumber(form.provider);
    try {
      await onConfirm(order.id, {
        provider: form.provider,
        trackingNumber,
        weight: form.weight,
        packageCount: form.packageCount,
      });
      setTrackingResult(trackingNumber);
    } catch (err: any) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10">
              <TruckIcon className="h-4 w-4 text-kp-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-kp-text-primary">Kargo Simülasyonu</h3>
              <p className="text-[10px] text-kp-text-tertiary">{order.orderNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Success State */}
        {trackingResult ? (
          <div className="p-6 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mx-auto">
              <CheckCircleIcon className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-kp-text-primary">Kargo Oluşturuldu!</p>
              <p className="text-xs text-kp-text-tertiary mt-1">
                Sipariş durumu <strong className="text-violet-400">Kargoda</strong> olarak güncellendi.
              </p>
            </div>
            <div className="bg-kp-bg-primary/60 border border-kp-border rounded-kp-md p-4">
              <p className="text-[10px] text-kp-text-tertiary uppercase tracking-widest mb-1">Takip Numarası</p>
              <p className="font-mono text-sm font-bold text-kp-accent">{trackingResult}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white py-2.5 text-xs font-semibold transition-all"
            >
              Kapat
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <p className="text-xs text-kp-text-secondary bg-kp-bg-primary/40 border border-kp-border rounded-kp-md p-3">
                Bu işlem sipariş durumunu{' '}
                <span className="font-semibold text-violet-400">Kargoda</span>'ya güncelleyecek ve bir takip numarası oluşturacaktır.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-kp-text-secondary mb-1.5">
                  Kargo Firması
                </label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1.5">
                    Ağırlık (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1.5">
                    Paket Sayısı
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.packageCount}
                    onChange={(e) => setForm({ ...form, packageCount: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TruckIcon className="h-3.5 w-3.5" />
                )}
                Kargo Oluştur
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
