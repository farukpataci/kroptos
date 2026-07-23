'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  ShoppingBagIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Product, CreateOrderPayload } from '../hooks/useOrders';

interface CreateOrderModalProps {
  products: Product[];
  onClose: () => void;
  onSubmit: (payload: CreateOrderPayload) => Promise<void>;
}

interface LineItem {
  productId: string;
  quantity: number;
}

type OrderTab = 'customer' | 'items' | 'settings';

const TABS: { value: OrderTab; labelKey: string; icon: any }[] = [
  { value: 'customer', labelKey: 'tabCustomer', icon: UserIcon },
  { value: 'items', labelKey: 'tabItems', icon: ShoppingBagIcon },
  { value: 'settings', labelKey: 'tabSettings', icon: Cog6ToothIcon },
];

const SOURCES = [
  { value: 'manual', labelKey: 'sourceManual' },
  { value: 'trendyol', label: 'Trendyol' },
  { value: 'hepsiburada', label: 'Hepsiburada' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'n11', label: 'N11' },
];

const CURRENCIES = [
  { value: 'TRY', label: '₺ TRY' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
];

export default function CreateOrderModal({ products, onClose, onSubmit }: CreateOrderModalProps) {
  const t = useTranslations('orders.createModal');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState<OrderTab>('customer');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    notes: '',
    source: 'manual',
    currency: 'TRY',
  });
  const [items, setItems] = useState<LineItem[]>([{ productId: products[0]?.id || '', quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addItem = () => {
    setItems([...items, { productId: products[0]?.id || '', quantity: 1 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  // Calculate total preview
  const totalPreview = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const currencySymbol = form.currency === 'TRY' ? '₺' : form.currency === 'USD' ? '$' : '€';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) {
      setError(t('errors.customerNameRequired'));
      setActiveTab('customer');
      return;
    }
    if (items.some((i) => !i.productId)) {
      setError(t('errors.productRequired'));
      setActiveTab('items');
      return;
    }
    if (items.some((i) => i.quantity < 1)) {
      setError(t('errors.quantityInvalid'));
      setActiveTab('items');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail || undefined,
        customerPhone: form.customerPhone || undefined,
        shippingAddress: form.shippingAddress || undefined,
        notes: form.notes || undefined,
        source: form.source,
        currency: form.currency,
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || t('errors.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  const labelCls = 'block text-[11px] font-medium text-kp-text-secondary mb-1';
  const inputCls = 'w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent transition-colors';

  return createPortal(
    <div className="fixed inset-0 z-50 bg-kp-bg-secondary flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-kp-border bg-kp-bg-primary/20 flex-shrink-0">
        <div>
          <h3 className="text-base font-bold text-kp-text-primary">{t('title')}</h3>
          <p className="text-xs text-kp-text-tertiary mt-0.5">{t('subtitle')}</p>
        </div>
        <button onClick={onClose} className="rounded-kp-md p-1.5 hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex border-b border-kp-border px-8 bg-kp-bg-primary/10 flex-shrink-0">
        {TABS.map(({ value, labelKey, icon: Icon }) => {
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-kp-accent text-kp-accent'
                  : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-kp-accent' : 'text-kp-text-tertiary'}`} />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {error && (
              <div className="flex items-start gap-2.5 p-4 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger animate-fade-in">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* customer tab */}
            {activeTab === 'customer' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>
                      {t('customerName')} <span className="text-kp-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      placeholder={t('customerNamePlaceholder')}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('email')}</label>
                    <input
                      type="email"
                      value={form.customerEmail}
                      onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                      placeholder="ornek@mail.com"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('phone')}</label>
                    <input
                      type="text"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      placeholder="+90 5xx xxx xx xx"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>{t('shippingAddress')}</label>
                    <input
                      type="text"
                      value={form.shippingAddress}
                      onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                      placeholder={t('shippingAddressPlaceholder')}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* items tab */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest">
                    {t('orderItems')}
                  </h4>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={products.length === 0}
                    className="flex items-center gap-1 text-[11px] font-semibold text-kp-accent hover:text-kp-accent-hover disabled:opacity-40 transition-colors"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {t('addRow')}
                  </button>
                </div>

                {products.length === 0 ? (
                  <div className="rounded-kp-md border border-kp-danger/20 bg-kp-danger/5 p-4 text-xs text-kp-danger">
                    {t('noProducts')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 px-1">
                      <span className="col-span-7 text-[9px] font-semibold uppercase tracking-wider text-kp-text-tertiary">{t('colProduct')}</span>
                      <span className="col-span-2 text-[9px] font-semibold uppercase tracking-wider text-kp-text-tertiary text-center">{t('colQuantity')}</span>
                      <span className="col-span-2 text-[9px] font-semibold uppercase tracking-wider text-kp-text-tertiary text-right">{t('colPrice')}</span>
                      <span className="col-span-1" />
                    </div>

                    {items.map((item, idx) => {
                      const selectedProduct = products.find((p) => p.id === item.productId);
                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-kp-bg-primary/40 border border-kp-border rounded-kp-md p-3">
                          <div className="col-span-7">
                            <select
                              value={item.productId}
                              onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                            >
                              <option value="" disabled>{t('selectProduct')}</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary text-center focus:outline-none focus:border-kp-accent"
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs font-semibold text-kp-text-primary">
                              {selectedProduct
                                ? `${currencySymbol}${(selectedProduct.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                                : '—'}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              disabled={items.length === 1}
                              className="text-kp-text-tertiary hover:text-kp-danger disabled:opacity-30 p-1.5 rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex justify-end pt-2 border-t border-kp-border mt-4">
                      <div className="text-right">
                        <span className="text-[10px] text-kp-text-tertiary block uppercase tracking-wider mb-0.5">{t('totalAmount')}</span>
                        <span className="text-base font-extrabold text-kp-text-primary">
                          {currencySymbol}{totalPreview.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* settings tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('source')}</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                    >
                      {SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>{'labelKey' in s && s.labelKey ? t(s.labelKey) : s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t('currency')}</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-none focus:border-kp-accent"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>{t('notes')}</label>
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder={t('notesPlaceholder')}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent resize-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-kp-border bg-kp-bg-primary/40 flex-shrink-0">
          <span className="text-xs text-kp-text-tertiary font-medium">
            {t('rowCount', { count: items.length })}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-kp-md border border-kp-border px-5 py-2.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
            >
              {tc('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || products.length === 0}
              className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
              {t('submit')}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
