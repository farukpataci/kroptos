'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BoltIcon,
  SparklesIcon,
  CreditCardIcon,
  TruckIcon,
  ClockIcon,
  UserPlusIcon,
  BuildingStorefrontIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { RecipeTemplate } from '../types';

export const RECIPE_CATALOG: RecipeTemplate[] = [
  {
    id: 'recipe-cod-high-amount',
    name: 'Kapıda Ödeme Yüksek Tutar Teyidi',
    description: 'Kapıda ödemeli ve tutarı 1000 TL üzeri siparişleri beklemeye al, teyit-gerekli etiketi ekle ve personele bildirim gönder.',
    category: 'payment',
    triggerType: 'ORDER_CREATED',
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'paymentMethod', operator: 'eq', value: 'cod' },
        { field: 'totalAmount', operator: 'gte', value: 1000 },
      ],
    },
    actions: [
      { type: 'HOLD_ORDER', config: { reason: 'Kapıda ödeme yüksek tutar teyidi bekliyor' } },
      { type: 'ADD_TAG', config: { tag: 'teyit-gerekli' } },
      { type: 'SEND_NOTIFICATION', config: { channel: 'internal', message: 'Yüksek tutarlı kapıda ödeme siparişi teyit bekliyor.' } },
    ],
    priority: 10,
    runOncePerOrder: true,
  },
  {
    id: 'recipe-heavy-cargo',
    name: 'Büyük Paket Kargo Yönlendirme',
    description: 'Toplam desi 30 üzeri olan hacimli siparişleri otomatik olarak Aras Kargo\'ya ata ve büyük-paket etiketi bas.',
    category: 'shipping',
    triggerType: 'ORDER_CREATED',
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'totalDesi', operator: 'gt', value: 30 },
      ],
    },
    actions: [
      { type: 'ASSIGN_CARRIER', config: { carrierId: 'aras', carrierName: 'Aras Kargo' } },
      { type: 'ADD_TAG', config: { tag: 'buyuk-paket' } },
    ],
    priority: 20,
    runOncePerOrder: true,
  },
  {
    id: 'recipe-paid-confirm-invoice',
    name: 'Ödeme Alındı → Onayla ve Fatura Kes',
    description: 'Ödemesi başarıyla tahsil edilen siparişi doğrudan Onaylandı durumuna al ve otomatik e-fatura oluştur.',
    category: 'payment',
    triggerType: 'PAYMENT_RECEIVED',
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'paymentStatus', operator: 'eq', value: 'PAID' },
      ],
    },
    actions: [
      { type: 'SET_ORDER_STATUS', config: { status: 'CONFIRMED' } },
      { type: 'CREATE_INVOICE', config: { autoSend: true } },
    ],
    priority: 30,
    runOncePerOrder: true,
  },
  {
    id: 'recipe-shipment-delay-sms',
    name: 'Kargo Gecikmesi Müşteri Bilgilendirme',
    description: 'Kargoya verildi durumunda 72 saattir teslim edilmemiş siparişlere gecikme etiketi ekle ve müşteriye SMS gönder.',
    category: 'shipping',
    triggerType: 'ORDER_IDLE',
    triggerConfig: { idleStatus: 'SHIPPED', idleHours: 72 },
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'status', operator: 'eq', value: 'SHIPPED' },
      ],
    },
    actions: [
      { type: 'ADD_TAG', config: { tag: 'gecikme' } },
      { type: 'SEND_NOTIFICATION', config: { channel: 'sms', templateCode: 'SHIPMENT_DELAY', recipient: 'customer' } },
    ],
    priority: 40,
    runOncePerOrder: false,
  },
  {
    id: 'recipe-prep-delayed-internal',
    name: 'Hazırlanması Geciken Sipariş Dahili Uyarı',
    description: 'Onaylandı durumunda 24 saattir kargoya verilmemiş siparişler için sorumlu personele dahili uyarı e-postası ilet.',
    category: 'fulfillment',
    triggerType: 'ORDER_IDLE',
    triggerConfig: { idleStatus: 'CONFIRMED', idleHours: 24 },
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'status', operator: 'eq', value: 'CONFIRMED' },
      ],
    },
    actions: [
      { type: 'ADD_TAG', config: { tag: 'geciken-sevkiyat' } },
      { type: 'SEND_NOTIFICATION', config: { channel: 'email', templateCode: 'SHIPMENT_PREPARATION_ALERT', recipient: 'internal' } },
    ],
    priority: 50,
    runOncePerOrder: false,
  },
  {
    id: 'recipe-first-order-welcome',
    name: 'İlk Sipariş Teşekkür ve Hoş Geldin',
    description: 'Müşterinin bu mağazadaki ilk siparişi oluşturulduğunda yeni-musteri etiketi ata ve teşekkür e-postası gönder.',
    category: 'customer',
    triggerType: 'ORDER_CREATED',
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'isFirstOrder', operator: 'eq', value: true },
      ],
    },
    actions: [
      { type: 'ADD_TAG', config: { tag: 'yeni-musteri' } },
      { type: 'SEND_NOTIFICATION', config: { channel: 'email', templateCode: 'WELCOME_FIRST_ORDER', recipient: 'customer' } },
    ],
    priority: 60,
    runOncePerOrder: true,
  },
  {
    id: 'recipe-marmara-warehouse',
    name: 'Marmara Bölgesi Depo Yönlendirme',
    description: 'İstanbul, Kocaeli, Bursa veya Tekirdağ teslimatlı siparişleri hızlı sevkiyat için Marmara Ana Depo\'ya ata.',
    category: 'shipping',
    triggerType: 'ORDER_CREATED',
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [
        { field: 'shippingCity', operator: 'in', value: ['İstanbul', 'Kocaeli', 'Bursa', 'Tekirdağ'] },
      ],
    },
    actions: [
      { type: 'ASSIGN_WAREHOUSE', config: { warehouseId: 'marmara-depo', warehouseName: 'Marmara Ana Depo' } },
    ],
    priority: 70,
    runOncePerOrder: true,
  },
  {
    id: 'recipe-carrier-exception-hold',
    name: 'Kargo İstisnası Siparişi Beklet ve Teyit İste',
    description: 'Kargo firması teslimat istisnası (adres bulunamadı vb.) bildirdiğinde siparişi beklet ve müşteriye adres teyit SMS\'i gönder.',
    category: 'exception',
    triggerType: 'SHIPMENT_EXCEPTION',
    conditions: {
      version: 1,
      operator: 'and',
      conditions: [],
    },
    actions: [
      { type: 'HOLD_ORDER', config: { reason: 'Kargo teslimat istisnası (adres ulaşılamadı)' } },
      { type: 'ADD_TAG', config: { tag: 'kargo-istisna' } },
      { type: 'SEND_NOTIFICATION', config: { channel: 'sms', templateCode: 'CARRIER_EXCEPTION_ALERT', recipient: 'customer' } },
    ],
    priority: 80,
    stopProcessing: true,
    runOncePerOrder: false,
  },
];

interface RecipeCatalogProps {
  onSelectRecipe: (recipe: RecipeTemplate) => void;
  canManage: boolean;
}

export default function RecipeCatalog({ onSelectRecipe, canManage }: RecipeCatalogProps) {
  const t = useTranslations('orderAutomation');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', label: 'Tüm Tarifler' },
    { id: 'payment', label: 'Ödeme & Fatura', icon: CreditCardIcon },
    { id: 'shipping', label: 'Kargo & Lojistik', icon: TruckIcon },
    { id: 'fulfillment', label: 'Hazırlık & Sevkiyat', icon: ClockIcon },
    { id: 'customer', label: 'Müşteri Deneyimi', icon: UserPlusIcon },
    { id: 'exception', label: 'İstisnalar', icon: ExclamationTriangleIcon },
  ];

  const filtered = RECIPE_CATALOG.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.triggerType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-kp-md px-3 py-1.5 text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-kp-accent text-white shadow-sm'
                  : 'border border-kp-border bg-white dark:bg-slate-900 text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-kp-text-primary'
              }`}
            >
              {cat.icon && <cat.icon className="h-3.5 w-3.5" />}
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kp-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tariflerde ara..."
            className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:border-kp-accent focus:outline-none focus:ring-1 focus:ring-kp-accent"
          />
        </div>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((recipe) => (
          <div
            key={recipe.id}
            className="group flex flex-col justify-between rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:border-kp-accent/40 hover:shadow-md"
          >
            <div className="space-y-3">
              {/* Header: Trigger Badge + Name */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                    <SparklesIcon className="h-4 w-4" />
                  </div>
                  <span className="inline-flex items-center rounded-kp-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-kp-text-secondary">
                    {recipe.triggerType}
                  </span>
                </div>
                <span className="text-[11px] text-kp-text-tertiary">
                  Öncelik: #{recipe.priority}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                  {recipe.name}
                </h3>
                <p className="mt-1 text-xs text-kp-text-tertiary leading-relaxed">
                  {recipe.description}
                </p>
              </div>

              {/* Conditions Summary */}
              <div className="rounded-kp-md bg-slate-50 dark:bg-slate-800/60 p-2.5 text-[11px] space-y-1.5">
                <div className="font-medium text-kp-text-secondary">Eğer (Koşullar):</div>
                <div className="flex flex-wrap gap-1">
                  {recipe.conditions.conditions.length === 0 ? (
                    <span className="text-kp-text-tertiary italic">Tüm siparişler</span>
                  ) : (
                    recipe.conditions.conditions.map((cond: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-kp-xs bg-white dark:bg-slate-900 px-1.5 py-0.5 border border-kp-border text-kp-text-secondary font-mono text-[10px]"
                      >
                        {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Actions Summary */}
              <div className="rounded-kp-md bg-slate-50 dark:bg-slate-800/60 p-2.5 text-[11px] space-y-1.5">
                <div className="font-medium text-kp-text-secondary">O Zaman (Aksiyonlar):</div>
                <div className="flex flex-wrap gap-1">
                  {recipe.actions.map((act, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-kp-xs bg-kp-accent-muted px-1.5 py-0.5 text-kp-accent font-medium text-[10px]"
                    >
                      {act.type}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom: Use Button */}
            <div className="mt-5 pt-3 border-t border-kp-border flex items-center justify-between">
              <span className="text-[11px] text-kp-text-tertiary">
                Hazır Şablon
              </span>
              <button
                type="button"
                onClick={() => onSelectRecipe(recipe)}
                disabled={!canManage}
                className="flex items-center gap-1 rounded-kp-md bg-kp-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-kp-accent/90 disabled:opacity-50"
              >
                <span>Kullan</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
