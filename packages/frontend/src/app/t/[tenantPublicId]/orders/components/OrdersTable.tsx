'use client';

import { useState } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  ChevronDownIcon,
  StarIcon,
  FlagIcon,
  EnvelopeIcon,
  DocumentIcon,
  PrinterIcon,
  TruckIcon,
  Bars3Icon,
  ArrowsUpDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { Order, OrderFilters } from '../hooks/useOrders';
import { OrderStatusBadge, PaymentStatusBadge, FulfillmentStatusBadge, SourceBadge } from './OrderStatusBadge';

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  filters: OrderFilters;
  totalFiltered: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onFilterChange: (filters: OrderFilters) => void;
  onPageChange: (page: number) => void;
  onRowClick: (order: Order) => void;
  onCreateOrder?: () => void;
}

const DATE_OPTIONS = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: '7', label: 'Son 7 Gün' },
  { value: '30', label: 'Son 30 Gün' },
  { value: '90', label: 'Son 90 Gün' },
];

export default function OrdersTable({
  orders,
  isLoading,
  filters,
  totalFiltered,
  currentPage,
  totalPages,
  pageSize,
  onFilterChange,
  onPageChange,
  onRowClick,
  onCreateOrder,
}: OrdersTableProps) {
  const totalOnPage = orders.length;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(startIdx + totalOnPage - 1, totalFiltered);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((item) => item !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAction = (actionName: string) => {
    if (selectedOrderIds.length === 0 && actionName !== 'Excel İhracatı (Tümü)') {
      showToast('Lütfen önce en az bir sipariş seçin!');
      setActiveDropdown(null);
      return;
    }
    
    const count = actionName === 'Excel İhracatı (Tümü)' ? totalFiltered : selectedOrderIds.length;
    showToast(`${count} sipariş için "${actionName}" işlemi başlatıldı.`);
    setActiveDropdown(null);
  };

  return (
    <div className="relative w-full">
      {/* Dropdown Backdrop to close on click outside */}
      {activeDropdown && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveDropdown(null)} />
      )}

      {/* Replicated Screenshot Action Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-kp-bg-primary/20 border-b border-kp-border z-40 relative">
        {/* Checkbox Options */}
        <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'select' ? null : 'select')}
              className="flex items-center gap-1 px-2 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
            >
              <input
                type="checkbox"
                checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length;
                  }
                }}
                onChange={toggleSelectAll}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-kp-border text-kp-accent focus:ring-0 cursor-pointer h-3.5 w-3.5 bg-kp-bg-primary"
              />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'select' && (
              <div className="absolute left-0 mt-1 w-40 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => { setSelectedOrderIds(orders.map(o => o.id)); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Tümünü Seç
                </button>
                <button
                  onClick={() => { setSelectedOrderIds([]); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Seçimi Temizle
                </button>
              </div>
            )}
          </div>

          {/* Star Options */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'star' ? null : 'star')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Yıldız / Önem"
            >
              <StarIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'star' && (
              <div className="absolute left-0 mt-1 w-40 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('Yıldızla')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Yıldız Ekle
                </button>
                <button
                  onClick={() => handleAction('Yıldızı Kaldır')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Yıldızı Kaldır
                </button>
              </div>
            )}
          </div>

          {/* Flag Options */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'flag' ? null : 'flag')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Bayrak / Etiket"
            >
              <FlagIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'flag' && (
              <div className="absolute left-0 mt-1 w-44 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('Kırmızı Bayrak Ekle')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500"></span> Kırmızı Bayrak
                </button>
                <button
                  onClick={() => handleAction('Mavi Bayrak Ekle')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span> Mavi Bayrak
                </button>
                <button
                  onClick={() => handleAction('Yeşil Bayrak Ekle')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-green-500"></span> Yeşil Bayrak
                </button>
                <hr className="border-kp-border my-1" />
                <button
                  onClick={() => handleAction('Bayrağı Kaldır')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Bayrağı Kaldır
                </button>
              </div>
            )}
          </div>

          {/* Envelope/Message */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'envelope' ? null : 'envelope')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Mesaj / E-posta Gönder"
            >
              <EnvelopeIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'envelope' && (
              <div className="absolute left-0 mt-1 w-48 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('E-posta Gönder')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  E-posta Bildirimi Gönder
                </button>
                <button
                  onClick={() => handleAction('SMS Gönder')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  SMS Bildirimi Gönder
                </button>
                <button
                  onClick={() => handleAction('WhatsApp Gönder')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  WhatsApp Mesajı Gönder
                </button>
              </div>
            )}
          </div>

          {/* Document/Export */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'document' ? null : 'document')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Fatura / Excel"
            >
              <DocumentIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'document' && (
              <div className="absolute left-0 mt-1 w-52 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('Fatura PDF Oluştur')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Toplu Fatura PDF Oluştur
                </button>
                <button
                  onClick={() => handleAction('Excel İhracatı (Seçilenler)')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-accent font-semibold"
                >
                  Excel'e Aktar (Seçilenler)
                </button>
                <button
                  onClick={() => handleAction('Excel İhracatı (Tümü)')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Excel'e Aktar (Tüm Sayfa)
                </button>
              </div>
            )}
          </div>

          {/* Printer */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'printer' ? null : 'printer')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Yazdır"
            >
              <PrinterIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'printer' && (
              <div className="absolute left-0 mt-1 w-48 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('Fatura Yazdır')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Faturaları Yazdır
                </button>
                <button
                  onClick={() => handleAction('Kargo Barkodu Yazdır')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Kargo Barkodlarını Yazdır
                </button>
                <button
                  onClick={() => handleAction('Çeki Listesi Yazdır')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Çeki Listesi Yazdır
                </button>
              </div>
            )}
          </div>

          {/* AWB Blue Button */}
          <button
            onClick={() => handleAction('Kargo Fişi Oluştur (AWB)')}
            className="flex items-center justify-center h-[28px] w-[32px] rounded bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
            title="Kargo Fişi Oluştur (AWB)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* Carrier/Truck */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'truck' ? null : 'truck')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Kargo Firmaları"
            >
              <TruckIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'truck' && (
              <div className="absolute left-0 mt-1 w-52 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('DPD Romania Kargo Gönderimi')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center justify-between"
                >
                  <span>DPD Romania</span>
                  <span className="text-[9px] bg-kp-accent/20 text-kp-accent rounded px-1.5 font-bold">Varsayılan</span>
                </button>
                <button
                  onClick={() => handleAction('Yurtiçi Kargo Entegrasyonu')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Yurtiçi Kargo
                </button>
                <button
                  onClick={() => handleAction('MNG Kargo Entegrasyonu')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  MNG Kargo
                </button>
                <button
                  onClick={() => handleAction('Aras Kargo Entegrasyonu')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Aras Kargo
                </button>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Toplu İşlemler"
            >
              <Bars3Icon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'more' && (
              <div className="absolute left-0 mt-1 w-44 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => handleAction('Toplu Durum Değiştir')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Toplu Durum Değiştir
                </button>
                <button
                  onClick={() => handleAction('Arşive Kaldır')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Arşive Kaldır
                </button>
                <hr className="border-kp-border my-1" />
                <button
                  onClick={() => handleAction('Toplu Sipariş Sil')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-red-500 font-semibold"
                >
                  Seçilenleri Sil
                </button>
              </div>
            )}
          </div>

          {/* Sort Columns */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title="Sırala"
            >
              <ArrowsUpDownIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
            </button>
            {activeDropdown === 'sort' && (
              <div className="absolute right-0 mt-1 w-48 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[11px]">
                <button
                  onClick={() => { onFilterChange({ ...filters, dateRange: 'all' }); showToast('Tarihe göre sıralandı.'); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Tarihe Göre Sırala
                </button>
                <button
                  onClick={() => { showToast('Sipariş noya göre sıralandı.'); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Sipariş No'ya Göre Sırala
                </button>
                <button
                  onClick={() => { showToast('Tutara göre sıralandı.'); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Tutara Göre Sırala
                </button>
              </div>
            )}
          </div>

          {/* Selected Counter */}
          {selectedOrderIds.length > 0 && (
            <span className="text-[11px] text-kp-accent font-semibold ml-2 animate-fade-in">
              {selectedOrderIds.length} sipariş seçildi
            </span>
          )}

          {/* Create Order Button */}
          {onCreateOrder && (
            <button
              onClick={onCreateOrder}
              className="ml-auto flex items-center justify-center gap-1.5 rounded bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all h-[28px]"
            >
              <span className="text-sm leading-none">+</span>
              Sipariş Oluştur
            </button>
          )}
        </div>


      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[10px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                  onChange={toggleSelectAll}
                  className="rounded border-kp-border text-kp-accent focus:ring-0 cursor-pointer h-3.5 w-3.5 bg-kp-bg-primary"
                />
              </th>
              <th className="py-3 px-4">Sipariş No</th>
              <th className="py-3 px-4">Müşteri</th>
              <th className="py-3 px-4">Ürünler</th>
              <th className="py-3 px-4">Sipariş Durumu</th>
              <th className="py-3 px-4">Ödeme</th>
              <th className="py-3 px-4">Karşılama</th>
              <th className="py-3 px-4 text-right">Tutar</th>
              <th className="py-3 px-4">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-4 px-4 w-10">
                    <div className="h-3.5 w-3.5 rounded bg-kp-bg-tertiary animate-pulse" />
                  </td>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="py-4 px-4">
                      <div className="h-3 rounded bg-kp-bg-tertiary animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📦</span>
                    <p className="text-sm font-medium text-kp-text-secondary">Sipariş bulunamadı</p>
                    <p className="text-xs text-kp-text-tertiary">
                      {filters.search || filters.status !== 'all' || filters.dateRange !== 'all'
                        ? 'Filtreleri değiştirerek tekrar deneyin.'
                        : 'İlk siparişi oluşturmak için "Sipariş Oluştur" butonuna tıklayın.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onRowClick(order)}
                  className="hover:bg-kp-bg-hover/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={(e) => toggleSelectOrder(order.id, e as any)}
                      className="rounded border-kp-border text-kp-accent focus:ring-0 cursor-pointer h-3.5 w-3.5 bg-kp-bg-primary"
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast('Sipariş favorilere eklendi.');
                        }}
                        className="text-kp-text-tertiary hover:text-yellow-400 transition-colors"
                        title="Yıldızla"
                      >
                        <StarIcon className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-mono text-[11px] font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                        {order.orderNumber}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-medium text-kp-text-primary text-[12px]">
                        {order.customerName || 'Walk-in'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-flex items-center justify-center text-[8px] font-bold text-white rounded-full h-3.5 w-3.5 ${
                          order.source === 'trendyol' ? 'bg-orange-500' : 'bg-slate-500'
                        }`}>
                          {order.source === 'trendyol' ? 'T' : 'M'}
                        </span>
                        <span className="text-[10px] text-kp-text-tertiary font-semibold">
                          {order.source === 'trendyol' ? 'Trendyol Magros' : 'Manuel Mağaza'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs truncate">
                    {order.items && order.items.length > 0 ? (
                      <span className="text-[11px] text-kp-text-secondary font-medium">
                        {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-kp-text-tertiary">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="py-3.5 px-4">
                    <FulfillmentStatusBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-semibold text-kp-text-primary text-[12px]">
                      {parseFloat(order.totalAmount.toString()).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {' '}
                      {order.currency === 'TRY' ? '₺' : order.currency === 'USD' ? '$' : order.currency === 'EUR' ? '€' : order.currency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="text-[11px] text-kp-text-secondary">
                        {new Date(order.createdAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-[10px] text-kp-text-tertiary">
                        {new Date(order.createdAt).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && totalFiltered > 0 && (
        <div className="flex items-center justify-between border-t border-kp-border px-4 py-3 bg-kp-bg-primary/10">
          <p className="text-[11px] text-kp-text-tertiary font-medium">
            <span className="font-semibold text-kp-text-secondary">{startIdx}–{endIdx}</span>
            {' '}/ {totalFiltered} sipariş
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page = i + 1;
              if (totalPages > 7) {
                if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-semibold transition-colors ${
                    currentPage === page
                      ? 'bg-kp-accent text-white shadow-sm'
                      : 'border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Premium Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded border border-kp-accent bg-kp-bg-primary px-4 py-3 shadow-2xl animate-fade-in transition-all duration-300">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-kp-accent/15 text-kp-accent">
            <CheckIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-kp-text-primary">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
