'use client';

import { useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  TruckIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { ProviderSummary } from '@kroptos/shared';
import { apiFetch } from '@/lib/api';

export interface CatalogProvider {
  id: string;
  name: string;
  category: 'marketplace' | 'ecommerce' | 'carrier' | 'accounting';
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
    name: 'Trendyol (Türkiye)',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    badgeText: 'Trendyol TR',
    description:
      'Trendyol Türkiye mağazanız. Otomatik sipariş, ürün ve anlık stok senkronizasyonu. Yurt dışı mağazalar için "Trendyol Global" kartını kullanın.',
    capabilities: ['Siparişler (1dk)', 'Stok (5dk)', 'Fiyatlar', 'Kargo Etiketi'],
    status: 'active',
  },
  {
    // Separate provider, not a mode of the card above: each country gets its own
    // integration record so category mappings, rate limits and connection
    // status stay apart.
    id: 'trendyol_global',
    name: 'Trendyol Global (Uluslararası)',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-orange-600/10 border-orange-600/20 text-orange-700',
    badgeText: 'Trendyol Global',
    description:
      'Trendyol\'un yurt dışı mağazaları. Kurulumda ülke seçilir; her ülke için ayrı bağlantı kurulur.',
    capabilities: ['Ülke seçimi', 'Siparişler', 'Stok', 'Fiyatlar'],
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
    // The card used to promise orders, stock and prices. None of the three has a
    // confirmed endpoint: n11's gateway answers 404 or "Application is not
    // available" for every path they were written against, so the integration
    // installs in simulation mode and only the two category endpoints are real.
    description:
      'n11 kategori ve nitelik okuma uçları doğrulandı. Sipariş, ürün ve stok uçları henüz doğrulanmadığı ' +
      'için entegrasyon simülasyon modunda kurulur: örnek veri üretir, pazaryerine istek göndermez ve ' +
      'hiçbir kaydı veritabanına yazmaz.',
    capabilities: ['Kategoriler', 'Nitelikler', 'Simülasyon modu'],
    status: 'beta',
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
    description:
      'İş Bankası Pazarama pazaryeri altyapısı. Sipariş, ürün ve stok akışı yazıldı; gerçek bir satıcı hesabında henüz doğrulanmadığı için beta.',
    // "Fiyatlar" bilerek yok: fiyat gönderen tek satır kod yok (bkz.
    // PazaramaConnector). Yapılamayan bir işlemin rozeti, satıcının hiç
    // çalışmayacak bir senkrona güvenmesiyle sonuçlanır.
    capabilities: ['Siparişler', 'Ürünler', 'Stok'],
    status: 'beta',
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
    name: 'eBay',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    badgeText: 'eBay',
    description:
      'eBay Sell API ile sipariş çekme ve stok gönderimi. Kurulumda pazar (site) seçilir; her site için ayrı bağlantı kurulur.',
    // Deliberately no "Fiyatlar": eBay models price on the offer rather than the
    // inventory item, so this connector cannot push it. Listing a capability
    // the integration does not have is how a seller ends up trusting a sync
    // that never happens.
    capabilities: ['Pazar seçimi', 'Siparişler', 'Stok', 'Kategoriler'],
    status: 'beta',
  },

  {
    id: 'temu',
    name: 'Temu',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    badgeText: 'Temu',
    description:
      'Hızla büyüyen küresel pazaryeri. Sipariş, ürün ve kategori çekimi yazıldı; gerçek bir satıcı hesabında henüz doğrulanmadığı için beta. Kurulumda bölgenizin API adresi girilir.',
    // Yalnızca connector'ın gerçekten istek attığı üç işlem. "Stok" bilerek yok:
    // updateStock gönderim yapmıyor (bkz. TemuConnector). Yapılamayan bir işlemin
    // rozeti, satıcının hiç çalışmayacak bir senkrona güvenmesiyle sonuçlanır.
    capabilities: ['Siparişler', 'Ürünler', 'Kategoriler'],
    status: 'beta',
  },

  // Planlanan pazaryerleri. Bunların hiçbirinin manifesti yok, dolayısıyla
  // registry onları tanımıyor ve kartları kendiliğinden "Çok yakında" olarak,
  // butonları devre dışı çıkıyor — burada ayrıca bir şey yapmak gerekmiyor.
  // Bir sağlayıcının manifesti eklendiği gün kartı kendiliğinden bağlanabilir
  // hale gelir; bu listede tek satır bile değişmez.
  //
  // `capabilities` burada bir taahhüt değil, planlanan kapsam. Kart bağlanabilir
  // olmadığı için kimse ona göre işlem yapamaz.
  {
    id: 'zalando',
    name: 'Zalando',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-slate-800/10 border-slate-800/20 text-slate-800 dark:text-slate-200',
    badgeText: 'Zalando',
    description:
      'Avrupa moda pazaryeri (zDirect Partner Programme). OAuth2 kimlik doğrulama, sipariş çekme, GTIN-13 EAN ile stok gönderimi ve kategori/outline eşleştirmesi.',
    // No "Varyantlar": there is no product or variant support at all — Zalando
    // publishes no article spec, so getProducts refuses. Listing a capability
    // the integration does not have is how a seller ends up trusting a sync
    // that never happens.
    capabilities: ['Siparişler', 'Stok', 'Kategoriler'],
    status: 'beta',
  },
  {
    id: 'allegro',
    name: 'Allegro',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-orange-600/10 border-orange-600/20 text-orange-700',
    badgeText: 'Allegro',
    description:
      'Polonya’nın en büyük pazaryeri. Sipariş çekme, ilan listeleme ve stok gönderimi. Kurulumda refresh token yapıştırılır.',
    // No "Fiyatlar": the connector patches stock only. Allegro can change price
    // through the same endpoint, but nothing here sends one, and listing a
    // capability the integration does not use is how a seller ends up trusting
    // a sync that never happens.
    capabilities: ['Siparişler', 'Ürünler', 'Stok', 'Kategoriler'],
    status: 'beta',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-600',
    badgeText: 'AliExpress',
    description:
      'Alibaba’nın küresel perakende pazaryeri (AliExpress Open Platform). App Key, App Secret ve Access Token ile sipariş çekme ve imza doğrulaması.',
    capabilities: ['Siparişler'],
    status: 'beta',
  },
  {
    id: 'emag',
    name: 'eMAG',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-sky-600/10 border-sky-600/20 text-sky-700',
    badgeText: 'eMAG',
    description: 'Romanya, Bulgaristan ve Macaristan’ın önde gelen pazaryeri. Entegrasyon planlanıyor.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'coming_soon',
  },
  {
    id: 'kaufland',
    name: 'Kaufland Marketplace',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'Kaufland',
    description: 'Almanya merkezli Kaufland pazaryeri. Sipariş ve stok senkronizasyonu planlanıyor.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'coming_soon',
  },
  {
    id: 'otto',
    name: 'OTTO Market',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-600',
    badgeText: 'OTTO',
    description: 'Almanya’nın büyük perakende pazaryeri. Sipariş ve ürün aktarımı planlanıyor.',
    capabilities: ['Siparişler', 'Stok', 'Varyantlar'],
    status: 'coming_soon',
  },
  {
    id: 'bol',
    name: 'Bol',
    category: 'marketplace',
    categoryLabel: 'Pazaryeri',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    badgeText: 'Bol',
    description: 'Hollanda ve Belçika’nın önde gelen pazaryeri. Entegrasyon planlanıyor.',
    capabilities: ['Siparişler', 'Stok', 'Fiyatlar'],
    status: 'coming_soon',
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
    name: 'DHL Express & Parcel',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-yellow-600/10 border-yellow-600/20 text-yellow-700',
    badgeText: 'DHL DE/EU',
    description: 'Almanya ve Avrupa geneli teslimat ağı. Amazon, eBay ve Kaufland pazaryeri kargo etiketleri ve canlı takip.',
    capabilities: ['Almanya & Avrupa', 'Amazon/eBay/Kaufland', 'Canlı Takip'],
    status: 'active',
  },
  {
    id: 'dpd',
    name: 'DPD Logistics',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'DPD EU',
    description: 'Almanya, Fransa, Polonya ve Hollanda başta olmak üzere Avrupa genelinde Amazon, Allegro ve eMAG kargo otomasyonu.',
    capabilities: ['Almanya/Fransa/Polonya', 'Allegro & eMAG', 'Barkod Basımı'],
    status: 'active',
  },
  {
    id: 'gls',
    name: 'GLS Parcel Service',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    badgeText: 'GLS EU',
    description: 'Avrupa geneli parsiyel paket dağıtımı. Amazon, eBay ve Allegro siparişleri için kargo takip entegrasyonu.',
    capabilities: ['Avrupa Geneli', 'Amazon/eBay/Allegro', 'Kargo Takip'],
    status: 'active',
  },
  {
    id: 'ups',
    name: 'UPS Express',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-amber-700/10 border-amber-700/20 text-amber-800 dark:text-amber-300',
    badgeText: 'UPS Global',
    description: 'Avrupa ve uluslararası express kargo gönderileri. Amazon ve eBay mağazaları için otomatik etiket üretimi.',
    capabilities: ['Uluslararası Kargo', 'Amazon & eBay', 'Express Teslimat'],
    status: 'active',
  },
  {
    id: 'inpost',
    name: 'InPost (Paczkomaty)',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-yellow-600/10 border-yellow-600/20 text-yellow-700',
    badgeText: 'InPost PL/UK/FR',
    description: 'Polonya, İngiltere, Fransa, İtalya ve İspanya kargo otomatı (Paczkomaty) ve kurye teslimat entegrasyonu. Allegro uyumlu.',
    capabilities: ['Polonya & İngiltere & Fransa', 'Paczkomaty Otomat', 'Allegro Entegre'],
    status: 'active',
  },
  {
    id: 'postnl',
    name: 'PostNL',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-orange-600/10 border-orange-600/20 text-orange-700',
    badgeText: 'PostNL NL',
    description: 'Hollanda ve Benelüks bölgesinin lider kargo altyapısı. Bol.com ve e-ticaret siteleri için kargo etiketleri.',
    capabilities: ['Hollanda (NL)', 'bol.com Uyumlu', 'Otomatik Etiket'],
    status: 'active',
  },
  {
    id: 'royal_mail',
    name: 'Royal Mail',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-red-700/10 border-red-700/20 text-red-800 dark:text-red-300',
    badgeText: 'Royal Mail UK',
    description: 'İngiltere ulusal kargo servisi. Amazon UK, eBay UK ve bağımsız e-ticaret mağazaları için takip ve etiketleme.',
    capabilities: ['İngiltere (UK)', 'Amazon UK & eBay UK', '2D Barkod'],
    status: 'active',
  },
  {
    id: 'evri',
    name: 'Evri (Hermes UK)',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-600',
    badgeText: 'Evri UK',
    description: 'İngiltere’nin önde gelen kapıdan kapıya kargo servisi. Amazon, eBay ve e-ticaret siteleri için hızlı gönderi servisi.',
    capabilities: ['İngiltere (UK)', 'Amazon & eBay UK', 'Parsel Takip'],
    status: 'active',
  },
  {
    id: 'colissimo',
    name: 'Colissimo / La Poste',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    badgeText: 'Colissimo FR',
    description: 'Fransa ulusal posta ve paket servisi. Cdiscount, Fnac ve Fransa e-ticaret siparişleri için kargo takip entegrasyonu.',
    capabilities: ['Fransa (FR)', 'Cdiscount & Fnac', 'Fransa İçi Dağıtım'],
    status: 'active',
  },
  {
    id: 'chronopost',
    name: 'Chronopost',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    badgeText: 'Chronopost FR',
    description: 'Fransa hızlı kurye ve express teslimat servisi. Cdiscount, Fnac ve ertesi gün teslimat paketleri.',
    capabilities: ['Fransa Express', 'Cdiscount & Fnac', '24 Saat Teslimat'],
    status: 'active',
  },
  {
    id: 'sameday',
    name: 'Sameday Courier',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-yellow-600/10 border-yellow-600/20 text-yellow-700',
    badgeText: 'Sameday RO/HU/BG',
    description: 'Romanya, Macaristan ve Bulgaristan bölgesi kargo ve Easybox otomat ağı. eMAG pazaryeri ile tam entegre.',
    capabilities: ['Romanya & Macaristan & Bulgaristan', 'eMAG Uyumlu', 'Easybox Otomat'],
    status: 'active',
  },
  {
    id: 'fan_courier',
    name: 'FAN Courier',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-blue-700/10 border-blue-700/20 text-blue-800 dark:text-blue-300',
    badgeText: 'FAN Courier RO',
    description: 'Romanya’nın 1 numaralı kargo şirketi. eMAG siparişleri ve Romanya içi hızlı teslimat servisleri.',
    capabilities: ['Romanya (RO)', 'eMAG Pazaryeri', 'AWB Oluşturma'],
    status: 'active',
  },
  {
    id: 'cargus',
    name: 'Cargus',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'Cargus RO',
    description: 'Romanya kargo ve kurye hizmetleri. eMAG ve bölgesel e-ticaret siteleri için kargo barkod ve takip entegrasyonu.',
    capabilities: ['Romanya (RO)', 'eMAG Entegrasyonu', 'Kargo Takip'],
    status: 'active',
  },
  {
    id: 'packeta',
    name: 'Packeta / Zásilkovna',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-600',
    badgeText: 'Packeta CZ/SK',
    description: 'Çekya, Slovakya ve Orta Avrupa teslimat ve gel-al noktası ağı. Kaufland ve Avrupa e-ticaret gönderileri.',
    capabilities: ['Çekya & Slovakya', 'Kaufland Uyumlu', 'Gel-Al Noktaları'],
    status: 'active',
  },
  {
    id: 'pocztex',
    name: 'Pocztex (Poczta Polska)',
    category: 'carrier',
    categoryLabel: 'Kargo & Lojistik',
    badgeBg: 'bg-red-700/10 border-red-700/20 text-red-800 dark:text-red-300',
    badgeText: 'Pocztex PL',
    description: 'Polonya Ulusal Posta servisi kargo ağı. Allegro siparişleri ve Polonya içi adrese/noktaya teslimat.',
    capabilities: ['Polonya (PL)', 'Allegro Uyumlu', 'Adrese Teslimat'],
    status: 'active',
  },

  // 💼 MUHASEBE ENTEGRASYONU (ERP & STOK & E-FATURA)
  {
    id: 'logo_go3',
    name: 'Logo GO3 / Tiger ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-sky-600/10 border-sky-600/20 text-sky-700',
    badgeText: 'Logo ERP',
    description: 'Logo REST / Web Servis entegrasyonu ile malzeme, stok hareketi ve sipariş akışı.',
    capabilities: ['Stok Kaynağı (Canlı)', 'Malzeme Kartları', 'Depo Sevkleri', 'Fatura'],
    status: 'active',
  },
  {
    id: 'mikro',
    name: 'Mikro ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'Mikro ERP',
    description: 'Mikro Jump / Fly ERP ile çift yönlü stok ve cari senkronizasyonu.',
    capabilities: ['Stok Aktarımı', 'Sipariş İrsaliye', 'Cari Bilgiler'],
    status: 'active',
  },
  {
    id: 'netsis',
    name: 'Logo Netsis ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-blue-700/10 border-blue-700/20 text-blue-800 dark:text-blue-300',
    badgeText: 'Netsis',
    description: 'Netsis Enterprise ERP web servis entegrasyonu ile üretim ve envanter takibi.',
    capabilities: ['Stok Kartları', 'Depo Yönetimi'],
    status: 'active',
  },
  {
    id: 'nebim',
    name: 'Nebim V3 ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-purple-600/10 border-purple-600/20 text-purple-700',
    badgeText: 'Nebim V3',
    description: 'Nebim V3 Perakende & Mağazacılık ERP stok ve envanter senkronizasyonu.',
    capabilities: ['Varyantlı Stok', 'Mağaza Depoları'],
    status: 'active',
  },
  {
    id: 'parasut',
    name: 'Paraşüt E-Fatura',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
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
    categoryLabel: 'Muhasebe Entegrasyonu',
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
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-indigo-600/10 border-indigo-600/20 text-indigo-700',
    badgeText: 'KolayBi',
    description: 'KolayBi bulut e-Fatura entegrasyonu ile otomatik resmi fatura oluşturma.',
    capabilities: ['e-Fatura', 'Cari Yönetimi'],
    status: 'active',
  },
  {
    id: 'sap',
    name: 'SAP S/4HANA & ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    badgeText: 'SAP ERP',
    description: 'Avrupa geneli kurumsal SAP ERP entegrasyonu ile finans, malzeme yönetimi ve stok senkronizasyonu.',
    capabilities: ['Global ERP', 'Finans & Muhasebe', 'Stok & Depo'],
    status: 'active',
  },
  {
    id: 'ms_dynamics',
    name: 'Microsoft Dynamics 365',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-cyan-600/10 border-cyan-600/20 text-cyan-700',
    badgeText: 'Dynamics 365',
    description: 'Microsoft Dynamics 365 Business Central ile KOBİ ve orta ölçekli finans, e-Fatura ve stok akışı.',
    capabilities: ['Business Central', 'Finansal Yönetim', 'E-Fatura'],
    status: 'active',
  },
  {
    id: 'sage',
    name: 'Sage Accounting & ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-emerald-600/10 border-emerald-600/20 text-emerald-700',
    badgeText: 'Sage',
    description: 'İngiltere, Fransa, Almanya ve İspanya odaklı Sage ön muhasebe ve finans çözümleri.',
    capabilities: ['İngiltere & AB', 'Ön Muhasebe', 'Fatura'],
    status: 'active',
  },
  {
    id: 'xero',
    name: 'Xero Cloud Accounting',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-sky-600/10 border-sky-600/20 text-sky-700',
    badgeText: 'Xero',
    description: 'İngiltere ve Avrupa KOBİ bulut muhasebe yazılımı ile fatura ve banka senkronizasyonu.',
    capabilities: ['Bulut Muhasebe', 'İngiltere & AB', 'Banka Entegrasyonu'],
    status: 'active',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-green-600/10 border-green-600/20 text-green-700',
    badgeText: 'QuickBooks',
    description: 'QuickBooks Online ile küçük ve orta işletmeler için otomatik faturalama ve gelir/gider takibi.',
    capabilities: ['Otomatik Fatura', 'Gelir/Gider', 'KOBİ Muhasebe'],
    status: 'active',
  },
  {
    id: 'odoo',
    name: 'Odoo ERP & Accounting',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-purple-600/10 border-purple-600/20 text-purple-700',
    badgeText: 'Odoo ERP',
    description: 'Açık kaynaklı ve bulut Odoo ERP ile e-Fatura, stok takibi ve çift yönlü muhasebe aktarımı.',
    capabilities: ['Açık Kaynak ERP', 'Stok & Depo', 'E-Fatura'],
    status: 'active',
  },
  {
    id: 'datev',
    name: 'DATEV',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-lime-600/10 border-lime-600/20 text-lime-700',
    badgeText: 'DATEV DE',
    description: 'Almanya pazar lideri DATEV muhasebeci ve KOBİ veri değişimi ve e-Fatura (ZUGFeRD/XRechnung).',
    capabilities: ['Almanya (DE)', 'ZUGFeRD / XRechnung', 'Maliye Entegrasyonu'],
    status: 'active',
  },
  {
    id: 'lexware',
    name: 'Lexware',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-amber-600/10 border-amber-600/20 text-amber-700',
    badgeText: 'Lexware DE',
    description: 'Almanya KOBİ ve küçük işletmeler için Lexware ön muhasebe ve fatura yazılımı.',
    capabilities: ['Almanya (DE)', 'Ön Muhasebe', 'Sipariş Aktarımı'],
    status: 'active',
  },
  {
    id: 'sevdesk',
    name: 'sevdesk',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    badgeText: 'sevdesk DACH',
    description: 'Almanya ve DACH bölgesi için sevdesk bulut muhasebe ve otomatik e-Fatura çözümü.',
    capabilities: ['DACH Bölgesi', 'Bulut Fatura', 'Stok Takibi'],
    status: 'active',
  },
  {
    id: 'freeagent',
    name: 'FreeAgent',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-indigo-600/10 border-indigo-600/20 text-indigo-700',
    badgeText: 'FreeAgent UK',
    description: 'İngiltere mikro işletme ve serbest meslek sahipleri için FreeAgent muhasebe yazılımı.',
    capabilities: ['İngiltere (UK)', 'Making Tax Digital', 'Mikro İşletme'],
    status: 'active',
  },
  {
    id: 'exact_online',
    name: 'Exact Online',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'Exact NL/BE',
    description: 'Hollanda ve Belçika KOBİ pazar lideri Exact Online ERP ve ön muhasebe entegrasyonu.',
    capabilities: ['Hollanda & Belçika', 'ERP & Muhasebe', 'Stok Senkronizasyonu'],
    status: 'active',
  },
  {
    id: 'visma',
    name: 'Visma ERP & Accounting',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-sky-600/10 border-sky-600/20 text-sky-700',
    badgeText: 'Visma Nordics',
    description: 'İskandinav ülkeleri (Norveç, İsveç, Finlandiya, Danimarka) ve Avrupa genelinde Visma ERP.',
    capabilities: ['İskandinavya (Nordics)', 'Kurumsal ERP', 'E-Fatura'],
    status: 'active',
  },
  {
    id: 'fortnox',
    name: 'Fortnox',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-green-700/10 border-green-700/20 text-green-800 dark:text-green-300',
    badgeText: 'Fortnox SE',
    description: 'İsveç bulut ön muhasebe pazar lideri Fortnox ile sipariş ve fatura akışı.',
    capabilities: ['İsveç (SE)', 'Bulut Muhasebe', 'KOBİ Fatura'],
    status: 'active',
  },
  {
    id: 'teamsystem',
    name: 'TeamSystem',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    badgeText: 'TeamSystem IT',
    description: 'İtalya pazar lideri TeamSystem ERP ve Fatturazione Elettronica e-Fatura entegrasyonu.',
    capabilities: ['İtalya (IT)', 'Fatturazione Elettronica', 'ERP & Muhasebe'],
    status: 'active',
  },
  {
    id: 'zucchetti',
    name: 'Zucchetti',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-rose-600/10 border-rose-600/20 text-rose-700',
    badgeText: 'Zucchetti IT',
    description: 'İtalya kurumsal ERP ve finans çözümü Zucchetti Mago / Ad Hoc entegrasyonu.',
    capabilities: ['İtalya (IT)', 'Kurumsal ERP', 'E-Fatura'],
    status: 'active',
  },
  {
    id: 'cegid',
    name: 'Cegid',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-violet-600/10 border-violet-600/20 text-violet-700',
    badgeText: 'Cegid FR/ES',
    description: 'Fransa, İspanya ve Portekiz pazarında Cegid perakende ve ERP muhasebe entegrasyonu.',
    capabilities: ['Fransa & İspanya', 'Retail ERP', 'Muhasebe'],
    status: 'active',
  },
  {
    id: 'pennylane',
    name: 'Pennylane',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-teal-600/10 border-teal-600/20 text-teal-700',
    badgeText: 'Pennylane FR',
    description: 'Fransa yükselen bulut finans platformu Pennylane e-Fatura ve muhasebe otomasyonu.',
    capabilities: ['Fransa (FR)', 'Bulut Finans', 'E-Fatura Otomasyonu'],
    status: 'active',
  },
  {
    id: 'comarch',
    name: 'Comarch ERP',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-amber-600/10 border-amber-600/20 text-amber-700',
    badgeText: 'Comarch PL/CEE',
    description: 'Polonya ve Orta Avrupa kurumsal Comarch ERP Altum / Optima stok ve muhasebe entegrasyonu.',
    capabilities: ['Polonya & CEE', 'Kurumsal ERP', 'KSeF E-Fatura'],
    status: 'active',
  },
  {
    id: 'enova365',
    name: 'enova365',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-red-600/10 border-red-600/20 text-red-700',
    badgeText: 'enova365 PL',
    description: 'Polonya KOBİ ERP yazılımı enova365 ile ticaret, stok ve KSeF e-Fatura uyumu.',
    capabilities: ['Polonya (PL)', 'KSeF Uyumlu', 'Stok & Ticaret'],
    status: 'active',
  },
  {
    id: 'netsuite',
    name: 'Oracle NetSuite',
    category: 'accounting',
    categoryLabel: 'Muhasebe Entegrasyonu',
    badgeBg: 'bg-blue-700/10 border-blue-700/20 text-blue-800 dark:text-blue-300',
    badgeText: 'Oracle NetSuite',
    description: 'Oracle NetSuite Cloud ERP ile global ölçekli finans, envanter, e-Fatura ve sipariş akışı.',
    capabilities: ['Global Cloud ERP', 'Çoklu Para Birimi', 'Konsolide Finans'],
    status: 'active',
  },
];

interface AddIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedProviderIds: string[];
  onSelectProvider: (provider: CatalogProvider) => void;
}

type CategoryTab = 'all' | 'marketplace' | 'ecommerce' | 'carrier' | 'accounting';

export function AddIntegrationModal({
  isOpen,
  onClose,
  connectedProviderIds,
  onSelectProvider,
}: AddIntegrationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  // `null` while the registry is still loading: until it answers we cannot tell
  // a connectable provider from one that only exists in this list.
  const [supportedMarketplaces, setSupportedMarketplaces] = useState<Set<string> | null>(null);

  // The backend registry is the authority on which marketplaces can actually be
  // connected. The catalogue used to assert this itself, which is how entries
  // with no manifest kept offering a "Bağlantı Kur" button that dead-ended in a
  // 400 from the schema endpoint.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    apiFetch<ProviderSummary[]>('/integrations/settings/providers')
      .then((providers) => {
        if (cancelled) return;
        setSupportedMarketplaces(new Set(providers.map((p) => p.provider.toLowerCase())));
      })
      .catch(() => {
        // A failed lookup must not present everything as connectable; an empty
        // set degrades to "coming soon", which is the safe direction.
        if (!cancelled) setSupportedMarketplaces(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * Only marketplaces can be connected through this modal — the setup wizard
   * resolves its form from the marketplace manifest registry, so an ERP, cargo,
   * accounting or e-commerce entry has no schema to render. Those are shown as
   * upcoming rather than removed, so the catalogue still says what is planned.
   */
  const isConnectable = (provider: CatalogProvider) =>
    provider.category === 'marketplace' && (supportedMarketplaces?.has(provider.id) ?? false);

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
      id: 'accounting',
      label: 'Muhasebe Entegrasyonu',
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
          { id: 'accounting', title: '💼 Muhasebe Entegrasyonu', items: filteredProviders.filter((p) => p.category === 'accounting') },
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
                    const connectable = isConnectable(provider);
                    const isPending = supportedMarketplaces === null;

                    return (
                      <div
                        key={provider.id}
                        className={`group flex flex-col justify-between rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 transition-all duration-200 ${
                          connectable
                            ? 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
                            : 'opacity-60'
                        }`}
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
                            ) : isPending ? null : !connectable ? (
                              <span className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 text-[0.6875rem] font-bold">
                                <ClockIcon className="h-3.5 w-3.5" />
                                Çok yakında
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
                            disabled={!connectable && !isConnected}
                            title={
                              connectable || isConnected
                                ? undefined
                                : 'Bu sağlayıcı için bağlantı formu henüz hazır değil.'
                            }
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                              isConnected
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                                : connectable
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-blue-500/20'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'
                            }`}
                          >
                            {connectable || isConnected ? (
                              <PlusIcon className="h-3.5 w-3.5 stroke-[2.5]" />
                            ) : (
                              <ClockIcon className="h-3.5 w-3.5 stroke-[2.5]" />
                            )}
                            <span>
                              {isConnected ? 'Ayarlar' : connectable ? 'Bağlantı Kur' : 'Çok yakında'}
                            </span>
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
