'use client';

import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  BanknotesIcon,
  TruckIcon,
  ShoppingBagIcon,
  ArrowPathIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { Order, OrderFilters } from '../hooks/useOrders';

interface OrderFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: OrderFilters;
  onApplyFilters: (newFilters: OrderFilters) => void;
  orders: Order[]; // For live count preview
}

const SOURCES = [
  { value: 'trendyol', label: 'Trendyol', color: 'border-orange-400/40 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20' },
  { value: 'hepsiburada', label: 'Hepsiburada', color: 'border-amber-400/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20' },
  { value: 'amazon', label: 'Amazon', color: 'border-yellow-400/40 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' },
  { value: 'n11', label: 'N11', color: 'border-red-400/40 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20' },
  { value: 'web', label: 'Web / E-Ticaret', color: 'border-blue-400/40 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20' },
  { value: 'manual', label: 'Manuel', color: 'border-slate-400/40 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40' },
];

const PAYMENT_STATUSES = [
  { value: 'paid', label: 'Ödendi' },
  { value: 'pending', label: 'Ödeme Bekliyor' },
  { value: 'refunded', label: 'İade Edildi' },
  { value: 'cod', label: 'Kapıda Ödeme' },
];

const FULFILLMENT_STATUSES = [
  { value: 'unfulfilled', label: 'Karşılanmadı' },
  { value: 'fulfilled', label: 'Karşılandı' },
  { value: 'partial', label: 'Kısmi Karşılama' },
  { value: 'returned', label: 'Geri İade' },
];

const DATE_PRESETS = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: '1', label: 'Bugün' },
  { value: '7', label: 'Son 7 Gün' },
  { value: '30', label: 'Son 30 Gün' },
  { value: '90', label: 'Son 3 Ay' },
  { value: 'custom', label: 'Özel Tarih Aralığı' },
];

export default function OrderFilterDrawer({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  orders,
}: OrderFilterDrawerProps) {
  const [draft, setDraft] = useState<OrderFilters>({ ...filters });

  // Reset draft whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...filters });
    }
  }, [isOpen, filters]);

  if (!isOpen) return null;

  // Toggle array values
  const toggleArrayFilter = (field: 'sources' | 'paymentStatuses' | 'fulfillmentStatuses', val: string) => {
    const list = draft[field] || [];
    if (list.includes(val)) {
      setDraft({ ...draft, [field]: list.filter((item) => item !== val) });
    } else {
      setDraft({ ...draft, [field]: [...list, val] });
    }
  };

  // Preview matching count with current draft
  const previewMatchCount = orders.filter((order) => {
    // Search
    if (draft.search) {
      const q = draft.search.toLowerCase();
      const matchesName = order.customerName?.toLowerCase().includes(q);
      const matchesNumber = order.orderNumber?.toLowerCase().includes(q);
      const matchesEmail = order.customerEmail?.toLowerCase().includes(q);
      const matchesPublicId = order.publicId?.toLowerCase().includes(q);
      if (!matchesName && !matchesNumber && !matchesEmail && !matchesPublicId) return false;
    }

    // Status
    if (draft.status && draft.status !== 'all' && order.status !== draft.status) {
      return false;
    }

    // Sources
    if (draft.sources && draft.sources.length > 0) {
      const orderSrc = (order.source || 'web').toLowerCase();
      if (!draft.sources.includes(orderSrc)) return false;
    }

    // Payment Statuses
    if (draft.paymentStatuses && draft.paymentStatuses.length > 0) {
      if (!draft.paymentStatuses.includes(order.paymentStatus)) return false;
    }

    // Fulfillment Statuses
    if (draft.fulfillmentStatuses && draft.fulfillmentStatuses.length > 0) {
      if (!draft.fulfillmentStatuses.includes(order.fulfillmentStatus)) return false;
    }

    // Min / Max Amount
    const amount = Number(order.totalAmount || 0);
    if (draft.minAmount !== undefined && draft.minAmount !== '' && amount < Number(draft.minAmount)) {
      return false;
    }
    if (draft.maxAmount !== undefined && draft.maxAmount !== '' && amount > Number(draft.maxAmount)) {
      return false;
    }

    // Date Range
    if (draft.dateRange === 'custom') {
      const orderDate = new Date(order.createdAt).getTime();
      if (draft.startDate && orderDate < new Date(draft.startDate).getTime()) return false;
      if (draft.endDate) {
        const end = new Date(draft.endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end.getTime()) return false;
      }
    } else if (draft.dateRange && draft.dateRange !== 'all') {
      const days = parseInt(draft.dateRange, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(order.createdAt) < cutoff) return false;
    }

    return true;
  }).length;

  const handleReset = () => {
    setDraft({
      search: '',
      status: 'all',
      dateRange: 'all',
      startDate: undefined,
      endDate: undefined,
      sources: [],
      paymentStatuses: [],
      fulfillmentStatuses: [],
      minAmount: '',
      maxAmount: '',
      carrier: '',
    });
  };

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-lg bg-kp-bg-secondary border-l border-kp-border shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-kp-border bg-kp-bg-primary/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-kp-text-primary">Gelişmiş Sipariş Filtreleri</h2>
                <p className="text-[0.6875rem] text-kp-text-tertiary">
                  Kriterleri belirleyin ve tabloyu daraltın
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-kp-text-tertiary hover:text-kp-text-primary hover:bg-kp-bg-hover transition"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-xs text-kp-text-secondary select-none">
            
            {/* 1. Genel Arama */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5">
                <span>Anahtar Kelime / Arama</span>
              </label>
              <input
                type="text"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                placeholder="Müşteri adı, sipariş no, e-posta veya telefon..."
                className="w-full bg-kp-bg-primary border border-kp-border rounded-lg px-3 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent transition"
              />
            </div>

            {/* 2. Sipariş Kanalları (Pazaryeri & Web) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5">
                <ShoppingBagIcon className="h-4 w-4 text-kp-accent" />
                <span>Satış Kanalı / Pazaryeri</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SOURCES.map((src) => {
                  const isSelected = (draft.sources || []).includes(src.value);
                  return (
                    <button
                      type="button"
                      key={src.value}
                      onClick={() => toggleArrayFilter('sources', src.value)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs font-semibold transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                          : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:bg-kp-bg-hover'
                      }`}
                    >
                      <span>{src.label}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Ödeme Durumu */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5">
                <BanknotesIcon className="h-4 w-4 text-emerald-500" />
                <span>Ödeme Durumu</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_STATUSES.map((pay) => {
                  const isSelected = (draft.paymentStatuses || []).includes(pay.value);
                  return (
                    <button
                      type="button"
                      key={pay.value}
                      onClick={() => toggleArrayFilter('paymentStatuses', pay.value)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs font-medium transition ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:bg-kp-bg-hover'
                      }`}
                    >
                      <span>{pay.label}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Karşılama Durumu (Fulfillment) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5">
                <TruckIcon className="h-4 w-4 text-violet-500" />
                <span>Karşılama (Fulfillment) Durumu</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FULFILLMENT_STATUSES.map((ful) => {
                  const isSelected = (draft.fulfillmentStatuses || []).includes(ful.value);
                  return (
                    <button
                      type="button"
                      key={ful.value}
                      onClick={() => toggleArrayFilter('fulfillmentStatuses', ful.value)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs font-medium transition ${
                        isSelected
                          ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                          : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:bg-kp-bg-hover'
                      }`}
                    >
                      <span>{ful.label}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Tarih Aralığı */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                <span>Tarih Aralığı</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {DATE_PRESETS.map((dp) => (
                  <button
                    type="button"
                    key={dp.value}
                    onClick={() => setDraft({ ...draft, dateRange: dp.value })}
                    className={`px-2.5 py-1.5 rounded-lg border text-center text-[0.6875rem] font-semibold transition ${
                      draft.dateRange === dp.value
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:bg-kp-bg-hover'
                    }`}
                  >
                    {dp.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs if 'custom' is selected */}
              {draft.dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-2 animate-fade-in">
                  <div>
                    <span className="text-[0.6875rem] text-kp-text-tertiary block mb-1">Başlangıç Tarihi:</span>
                    <input
                      type="date"
                      value={draft.startDate || ''}
                      onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-lg px-2.5 py-1.5 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <span className="text-[0.6875rem] text-kp-text-tertiary block mb-1">Bitiş Tarihi:</span>
                    <input
                      type="date"
                      value={draft.endDate || ''}
                      onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-lg px-2.5 py-1.5 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 6. Tutar Aralığı */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5">
                <span>Toplam Tutar Aralığı</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Min Tutar (TL)"
                    value={draft.minAmount ?? ''}
                    onChange={(e) => setDraft({ ...draft, minAmount: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-lg px-3 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max Tutar (TL)"
                    value={draft.maxAmount ?? ''}
                    onChange={(e) => setDraft({ ...draft, maxAmount: e.target.value })}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-lg px-3 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer with Live Match Counter & Actions */}
          <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-kp-text-primary">
                {previewMatchCount} sipariş eşleşti
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-kp-border text-kp-text-secondary hover:text-kp-danger hover:border-kp-danger/30 transition text-xs font-semibold"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                <span>Sıfırla</span>
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition"
              >
                <CheckIcon className="h-4 w-4" />
                <span>Filtreleri Uygula</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
