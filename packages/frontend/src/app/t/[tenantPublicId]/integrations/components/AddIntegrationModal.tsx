'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  TruckIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export interface CatalogProvider {
  id: string;
  name: string;
  category: 'marketplace' | 'ecommerce' | 'carrier' | 'erp' | 'accounting';
  categoryLabel: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  capabilities: string[];
  status?: 'active' | 'beta' | 'coming_soon';
}

export const CATALOG_PROVIDERS: CatalogProvider[] = [
  // 🛒 PAZARYERLERİ
  {
    id: 'trendyol',
    name: 'Trendyol',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    badgeText: 'Trendyol',
    description: 'Türkiye\'nin lider pazaryeri. Otomatik sipariş, ürün ve anlık stok senkronizasyonu.',
    capabilities: ['Siparişler (1dk)', 'Stok (5dk)', 'Fiyatlar', 'Kargo Etiketi'],
    status: 'active',
  },
  {
    id: 'hepsiburada',
    name: 'Hepsiburada',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
    badgeText: 'Hepsiburada',
    description: 'Hepsiburada Merchant API ile otomatik ürün listeleme ve çift yönlü stok aktarımı.',
    capabilities: ['Siparişler (1dk)', 'Stok (5dk)', 'Ürünler', 'Fatura'],
    status: 'active',
  },
  {
    id: 'amazon',
    name: 'Amazon Seller Central',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-slate-700/10 border-slate-700/20 text-slate-800 dark:text-slate-200',
    badgeText: 'Amazon',
    description: 'Amazon SP-API altyapısı ile küresel ve yerel Amazon mağaza stok takibi.',
    capabilities: ['Siparişler', 'Stok (5dk)', 'Fiyatlar'],
    status: 'active',
  },
  {
    id: 'n11',
    name: 'N11 Pazaryeri',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-600',
    badgeText: 'N11',
    description: 'N11 REST API ile anlık kategori eşleştirme, fiyat ve stok senkronizasyonu.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'active',
  },
  {
    id: 'ciceksepeti',
    name: 'Çiçeksepeti',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-pink-500/10 border-pink-500/20 text-pink-600',
    badgeText: 'Çiçeksepeti',
    description: 'Çiçeksepeti pazaryeri mağaza bağlantısı, ürün güncellemeleri ve sipariş yönetimi.',
    capabilities: ['Siparişler', 'Stok', 'Varyantlar'],
    status: 'active',
  },
  {
    id: 'pazarama',
    name: 'Pazarama',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    badgeText: 'Pazarama',
    description: 'İş Bankası Pazarama pazaryeri altyapısı ile doğrudan ürün ve sipariş senkronizasyonu.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'active',
  },
  {
    id: 'pttavm',
    name: 'PttAVM',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700',
    badgeText: 'PttAVM',
    description: 'PTT\'nin pazaryeri. Sipariş çekme, stok ve fiyat aktarımı.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'active',
  },
  {
    id: 'idefix',
    name: 'idefix',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-600',
    badgeText: 'idefix',
    description: 'Kitap, hobi ve teknoloji odaklı pazaryeri. Ürün ve sipariş senkronizasyonu.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar', 'Kargo Etiketi'],
    status: 'active',
  },
  {
    id: 'etsy',
    name: 'Etsy Global',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-orange-600/10 border-orange-600/20 text-orange-700',
    badgeText: 'Etsy',
    description: 'Küresel Etsy el yapımı ve tasarım mağazanız için sipariş çekme ve stok eşleme.',
    capabilities: ['Siparişler', 'Stok', 'Döviz Dönüşümü'],
    status: 'beta',
  },
  {
    id: 'ebay',
    name: 'eBay Commerce',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    badgeText: 'eBay',
    description: 'eBay REST API ile uluslararası satışlarınızı ve sipariş akışını yönetin.',
    capabilities: ['Siparişler', 'Stok', 'Kargo Kodu'],
    status: 'beta',
  },

  // 🛍️ E-TİCARET ALTYAPILARI
  {
    id: 'shopify',
    name: 'Shopify E-Ticaret',
    category: 'ecommerce',
    categoryLabel: 'E-Ticaret Altyapısı',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    badgeText: 'Shopify',
    description: 'Shopify e-ticaret siteniz ile çift yönlü canlı stok ve envanter eşitlemesi.',
    capabilities: ['Siparişler (Anlık)', 'Stok Senkron', 'Ürün Kataloğu', 'Müşteriler'],
    status: 'active',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'ecommerce',
    categoryLabel: 'E-Ticaret Altyapısı',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-600',
    badgeText: 'WooCommerce',
    description: 'WordPress WooCommerce REST API entegrasyonu ile ürün ve stok yönetimi.',
    capabilities: ['Siparişler', 'Stok', 'Varyant Eşleme'],
    status: 'active',
  },
  {
    id: 'ideasoft',
    name: 'IdeaSoft',
    category: 'ecommerce',
    categoryLabel: 'E-Ticaret Altyapısı',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600',
    badgeText: 'IdeaSoft',
    description: 'IdeaSoft e-ticaret altyapınız ile doğrudan sipariş aktarımı ve stok senkronizasyonu.',
    capabilities: ['Siparişler', 'Stok', 'Kategori Eşleme'],
    status: 'active',
  },
  {
    id: 'ticimax',
    name: 'Ticimax',
    category: 'ecommerce',
    categoryLabel: 'E-Ticaret Altyapısı',
    badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-600',
    badgeText: 'Ticimax',
    description: 'Ticimax Web Servisleri ile ürün, fiyat ve stok verilerinizi anında güncelleyin.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'active',
  },
  {
    id: 'tsoft',
    name: 'T-Soft',
    category: 'ecommerce',
    categoryLabel: 'E-Ticaret Altyapısı',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600',
    badgeText: 'T-Soft',
    description: 'T-Soft e-ticaret sisteminiz ile yüksek hacimli sipariş ve stok entegrasyonu.',
    capabilities: ['Siparişler', 'Stok', 'Ürün Kataloğu'],
    status: 'active',
  },
  {
    id: 'opencart',
    name: 'OpenCart',
    category: 'ecommerce',
    categoryLabel: 'E-Ticaret Altyapısı',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    badgeText: 'OpenCart',
    description: 'OpenCart açık kaynak e-ticaret siteleri için özel API entegrasyon modülü.',
    capabilities: ['Siparişler', 'Stok'],
    status: 'active',
  },

  // 🚚 KARGO & LOJİSTİK
  {
    id: 'yurtici',
    name: 'Yurtiçi Kargo',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    badgeText: 'Yurtiçi',
    description: 'Otomatik kargo barkodu ve takip numarası sorgulama servisleri.',
    capabilities: ['Barkod Basımı', 'Kargo Takip No (Canlı)', 'Durum Güncelleme'],
    status: 'active',
  },
  {
    id: 'aras',
    name: 'Aras Kargo',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-green-600/10 border-green-600/20 text-green-700',
    badgeText: 'Aras Kargo',
    description: 'Aras Kargo Web Servisleri ile kargo gönderisi oluşturma ve takip akışı.',
    capabilities: ['Etiket Oluşturma', 'Kargo Takip No'],
    status: 'active',
  },
  {
    id: 'mng',
    name: 'MNG Kargo',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    badgeText: 'MNG Kargo',
    description: 'MNG Kargo entegrasyonu ile otomatik irsaliye ve kargo etiketi senkronizasyonu.',
    capabilities: ['Kargo Takip', 'Barkod Basımı'],
    status: 'active',
  },
  {
    id: 'sendeo',
    name: 'Sendeo Kargo',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-teal-500/10 border-teal-500/20 text-teal-600',
    badgeText: 'Sendeo',
    description: 'Sendeo Kargo hızlı paket teslimat ve durum bildirimi entegrasyonu.',
    capabilities: ['Anlık Takip', 'Zamanlı Teslimat'],
    status: 'active',
  },
  {
    id: 'hepsijet',
    name: 'HepsiJET',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-orange-600/10 border-orange-600/20 text-orange-700',
    badgeText: 'HepsiJET',
    description: 'HepsiJET hızlı kargo dağıtım ve randevulu teslimat servisleri.',
    capabilities: ['Saha Takibi', 'Otomatik Barkod'],
    status: 'active',
  },
  {
    id: 'dhl',
    name: 'DHL Express',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-yellow-600/10 border-yellow-600/20 text-yellow-700',
    badgeText: 'DHL',
    description: 'Uluslararası DHL Express kargo gönderi oluşturma ve gümrük etiketleri.',
    capabilities: ['Uluslararası Kargo', 'Tracking API'],
    status: 'active',
  },

  // 🏬 ERP & STOK / DEPO
  {
    id: 'logo_go3',
    name: 'Logo GO3 / Tiger ERP',
    category: 'erp',
    categoryLabel: 'ERP & Stok',
    badgeBg: 'bg-sky-600/10 border-sky-600/20 text-sky-700',
    badgeText: 'Logo ERP',
    description: 'Logo REST / Web Servis entegrasyonu ile malzeme, stok hareketi ve sipariş akışı.',
    capabilities: ['Stok Kaynağı (Canlı)', 'Malzeme Kartları', 'Depo Sevkleri', 'Fatura'],
    status: 'active',
  },
  {
    id: 'mikro',
    name: 'Mikro ERP',
    category: 'erp',
    categoryLabel: 'ERP & Stok',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'Mikro ERP',
    description: 'Mikro Jump / Fly ERP ile çift yönlü stok ve cari senkronizasyonu.',
    capabilities: ['Stok Aktarımı', 'Sipariş İrsaliye', 'Cari Bilgiler'],
    status: 'active',
  },
  {
    id: 'netsis',
    name: 'Logo Netsis ERP',
    category: 'erp',
    categoryLabel: 'ERP & Stok',
    badgeBg: 'bg-blue-700/10 border-blue-700/20 text-blue-800 dark:text-blue-300',
    badgeText: 'Netsis',
    description: 'Netsis Enterprise ERP web servis entegrasyonu ile üretim ve envanter takibi.',
    capabilities: ['Stok Kartları', 'Depo Yönetimi'],
    status: 'active',
  },
  {
    id: 'nebim',
    name: 'Nebim V3 ERP',
    category: 'erp',
    categoryLabel: 'ERP & Stok',
    badgeBg: 'bg-purple-600/10 border-purple-600/20 text-purple-700',
    badgeText: 'Nebim V3',
    description: 'Nebim V3 Perakende & Mağazacılık ERP stok ve envanter senkronizasyonu.',
    capabilities: ['Varyantlı Stok', 'Mağaza Depoları'],
    status: 'active',
  },

  // 🧾 E-FATURA & MUHASEBE
  {
    id: 'parasut',
    name: 'Paraşüt E-Fatura',
    category: 'accounting',
    categoryLabel: 'E-Fatura & Muhasebe',
    badgeBg: 'bg-emerald-600/10 border-emerald-600/20 text-emerald-700',
    badgeText: 'Paraşüt',
    description: 'Paraşüt bulut ön muhasebe uygulaması ile otomatik e-Fatura ve e-Arşiv resmi belgeleme.',
    capabilities: ['e-Fatura Kesme', 'e-Arşiv', 'Cari Hesap'],
    status: 'active',
  },
  {
    id: 'bizimhesap',
    name: 'BizimHesap',
    category: 'accounting',
    categoryLabel: 'E-Fatura & Muhasebe',
    badgeBg: 'bg-teal-600/10 border-teal-600/20 text-teal-700',
    badgeText: 'BizimHesap',
    description: 'BizimHesap online ön muhasebe ile pazaryeri siparişlerinizi anında faturalandırın.',
    capabilities: ['e-Fatura', 'Stok Takip', 'Gider Hesabı'],
    status: 'active',
  },
  {
    id: 'kolaybi',
    name: 'KolayBi',
    category: 'accounting',
    categoryLabel: 'E-Fatura & Muhasebe',
    badgeBg: 'bg-indigo-600/10 border-indigo-600/20 text-indigo-700',
    badgeText: 'KolayBi',
    description: 'KolayBi bulut e-Fatura entegrasyonu ile otomatik resmi fatura oluşturma.',
    capabilities: ['e-Fatura', 'Cari Yönetimi'],
    status: 'active',
  },
];

interface AddIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedProviderIds: string[];
  onSelectProvider: (provider: CatalogProvider) => void;
}

type CategoryTab = 'all' | 'marketplace' | 'ecommerce' | 'carrier' | 'erp' | 'accounting';

export function AddIntegrationModal({
  isOpen,
  onClose,
  connectedProviderIds,
  onSelectProvider,
}: AddIntegrationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');

  if (!isOpen) return null;

  const CATEGORY_TABS: { id: CategoryTab; label: string; icon: any; count: number }[] = [
    {
      id: 'all',
      label: 'Tümü',
      icon: SparklesIcon,
      count: CATALOG_PROVIDERS.length,
    },
    {
      id: 'marketplace',
      label: 'Pazaryerleri',
      icon: BuildingStorefrontIcon,
      count: CATALOG_PROVIDERS.filter((p) => p.category === 'marketplace').length,
    },
    {
      id: 'ecommerce',
      label: 'E-Ticaret Altyapıları',
      icon: ShoppingBagIcon,
      count: CATALOG_PROVIDERS.filter((p) => p.category === 'ecommerce').length,
    },
    {
      id: 'carrier',
      label: 'Kargo & Lojistik',
      icon: TruckIcon,
      count: CATALOG_PROVIDERS.filter((p) => p.category === 'carrier').length,
    },
    {
      id: 'erp',
      label: 'ERP & Stok',
      icon: CpuChipIcon,
      count: CATALOG_PROVIDERS.filter((p) => p.category === 'erp').length,
    },
    {
      id: 'accounting',
      label: 'E-Fatura & Muhasebe',
      icon: DocumentTextIcon,
      count: CATALOG_PROVIDERS.filter((p) => p.category === 'accounting').length,
    },
  ];

  // Filter logic based on tab & live search query
  const filteredProviders = CATALOG_PROVIDERS.filter((provider) => {
    const matchesTab = activeTab === 'all' || provider.category === activeTab;
    const matchesQuery =
      searchQuery.trim() === '' ||
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.capabilities.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesQuery;
  });

  // Group providers by category for structured sections when viewing 'all'
  const categoriesToRender: { id: string; title: string; items: CatalogProvider[] }[] = (
    activeTab === 'all'
      ? [
          { id: 'marketplace', title: '🛒 Pazaryerleri', items: filteredProviders.filter((p) => p.category === 'marketplace') },
          { id: 'ecommerce', title: '🛍️ E-Ticaret Altyapıları', items: filteredProviders.filter((p) => p.category === 'ecommerce') },
          { id: 'carrier', title: '🚚 Kargo & Lojistik', items: filteredProviders.filter((p) => p.category === 'carrier') },
          { id: 'erp', title: '🏬 ERP & Depo / Stok', items: filteredProviders.filter((p) => p.category === 'erp') },
          { id: 'accounting', title: 'Receipt E-Fatura & Muhasebe', items: filteredProviders.filter((p) => p.category === 'accounting') },
        ]
      : [
          {
            id: activeTab,
            title: CATEGORY_TABS.find((t) => t.id === activeTab)?.label || 'Entegrasyonlar',
            items: filteredProviders,
          },
        ]
  ).filter((cat) => cat.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative flex flex-col h-[90vh] w-full max-w-6xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <PlusIcon className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Yeni Entegrasyon Ekle</h2>
              <p className="text-xs text-slate-500">Sisteminize eklemek istediğiniz platform veya servisi seçin</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Live Search & Category Filter Toolbar */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 space-y-4 bg-white dark:bg-slate-900">
          {/* Realtime Search Input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Entegrasyon ara... (Örn: Trendyol, Logo, Shopify, Yurtiçi Kargo...)"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Catalog Grid View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin bg-slate-50/40 dark:bg-slate-950/20">
          {categoriesToRender.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <MagnifyingGlassIcon className="h-10 w-10 text-slate-300 animate-bounce" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Aramanızla eşleşen entegrasyon bulunamadı
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Lütfen arama teriminizi değiştirin veya farklı bir kategori seçin.
              </p>
            </div>
          ) : (
            categoriesToRender.map((catGroup) => (
              <div key={catGroup.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {catGroup.title} ({catGroup.items.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {catGroup.items.map((provider) => {
                    const isConnected = connectedProviderIds.includes(provider.id);

                    return (
                      <div
                        key={provider.id}
                        className="group flex flex-col justify-between rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 transition-all duration-200 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5"
                      >
                        <div>
                          {/* Card Header & Badge */}
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[0.6875rem] font-bold ${provider.badgeBg}`}>
                              {provider.badgeText}
                            </span>
                            {isConnected ? (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 text-[0.6875rem] font-bold border border-emerald-200 dark:border-emerald-800">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Bağlı
                              </span>
                            ) : provider.status === 'beta' ? (
                              <span className="rounded-full bg-purple-50 text-purple-600 px-2 py-0.5 text-[0.6875rem] font-bold">
                                Beta
                              </span>
                            ) : null}
                          </div>

                          {/* Provider Name & Description */}
                          <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                            {provider.name}
                          </h4>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {provider.description}
                          </p>

                          {/* Capabilities Pills */}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {provider.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[0.625rem] font-medium text-slate-600 dark:text-slate-300"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Card Action Footer */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                          <span className="text-[0.6875rem] font-medium text-slate-400">
                            {provider.categoryLabel}
                          </span>
                          <button
                            onClick={() => {
                              onSelectProvider(provider);
                              onClose();
                            }}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                              isConnected
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-blue-500/20'
                            }`}
                          >
                            <PlusIcon className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>{isConnected ? 'Ayarlar' : 'Bağlantı Kur'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
