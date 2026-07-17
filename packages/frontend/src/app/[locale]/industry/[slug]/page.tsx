'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar/Navbar';
import Footer from '@/components/layout/Footer/Footer';
import { useAuth } from '@/lib/auth-context';
import { CheckCircleIcon } from '@heroicons/react/20/solid';

// SSS Accordion Item Component
interface AccordionItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

function AccordionItem({ question, answer, isOpen, onClick }: AccordionItemProps) {
  return (
    <div className="border-b border-kp-border-subtle py-4">
      <button
        onClick={onClick}
        type="button"
        className="flex w-full items-center justify-between text-left focus:outline-none"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-kp-text-primary hover:text-kp-accent transition-colors duration-150">
          {question}
        </span>
        <span className="ml-6 flex h-7 items-center">
          <svg
            className={`h-5 w-5 transform text-kp-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180 text-kp-accent' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      <div
        className={`mt-2 overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-sm text-kp-text-secondary leading-relaxed pr-8">
          {answer}
        </p>
      </div>
    </div>
  );
}

// Custom SVGs for platforms and benefits
const IconShop = () => (
  <svg className="h-6 w-6 text-kp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.5a.75.75 0 00.75-.75V14a.75.75 0 00-.75-.75h-3.5A.75.75 0 006 14v3.25c0 .414.336.75.75.75z" />
  </svg>
);

const IconSync = () => (
  <svg className="h-6 w-6 text-kp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const IconBarcode = () => (
  <svg className="h-6 w-6 text-kp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 16.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM19.5 16.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM16.5 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  </svg>
);

const IconTruck = () => (
  <svg className="h-6 w-6 text-kp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177V18.75m0-11.177L12 3.75m0 0H6.75A2.25 2.25 0 004.5 6v10.5m7.5-12.75v12.75" />
  </svg>
);

// Struct for Sector content mapping
interface SolutionSection {
  num: string;
  tagTr: string;
  tagEn: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  featuresTr: string[];
  featuresEn: string[];
  mockupType: 'variant' | 'expiry' | 'imei' | 'desi' | 'oem' | 'coldchain';
}

interface SectorData {
  titleTr: string;
  titleEn: string;
  tagTr: string;
  tagEn: string;
  h1Tr: string;
  h1En: string;
  descTr: string;
  descEn: string;
  metricsTr: { label: string; val: string; trend: string }[];
  metricsEn: { label: string; val: string; trend: string }[];
  solutions: SolutionSection[];
  faqs: { qTr: string; qEn: string; aTr: string; aEn: string }[];
}

const SECTOR_DATA_MAP: Record<string, SectorData> = {
  'home-and-garden': {
    titleTr: 'Ev ve Bahçe E-Ticaret Entegrasyonu | Alqora',
    titleEn: 'Home & Garden E-Commerce Integration | Alqora',
    tagTr: 'Ev ve Bahçe Sektörü İçin Alqora',
    tagEn: 'Alqora for Home & Garden',
    h1Tr: 'Ev ve Bahçe Satış Operasyonunuzu Tek Merkezden Yönetin',
    h1En: 'Manage Your Home & Garden Operations from a Single Center',
    descTr: 'Mobilyadan dekorasyona, bahçe ürünlerinden aydınlatmaya kadar geniş ürün kataloğunuzu; sipariş, stok, depo, kargo ve pazaryeri süreçleriyle birlikte tek platformda yönetin. Tekrarlayan görevleri otomatikleştirin, operasyon hatalarını azaltın ve satış kanallarınızı kontrollü biçimde büyütün.',
    descEn: 'Manage your extensive product catalog from furniture to decor, garden goods to lighting, alongside orders, stock, warehouse, carrier flows, and marketplace sync within one platform. Automate repetitive tasks, minimize errors, and scale your sales channels.',
    metricsTr: [
      { label: 'Bugünkü Siparişler', val: '1,482', trend: '+14%' },
      { label: 'Kritik Stok Uyarısı', val: '12 Ürün', trend: 'Kritik' },
      { label: 'Sevkiyat Durumu', val: '98.4%', trend: 'Başarı' }
    ],
    metricsEn: [
      { label: 'Today\'s Orders', val: '1,482', trend: '+14%' },
      { label: 'Critical Stock Alert', val: '12 SKU', trend: 'Critical' },
      { label: 'Shipping Status', val: '98.4%', trend: 'Ontime' }
    ],
    solutions: [
      {
        num: '01',
        tagTr: 'Hacimli Lojistik',
        tagEn: 'Heavy Logistics',
        titleTr: 'Büyük ve Hacimli Ürünlerin Sevkiyatı',
        titleEn: 'Shipping Large & Bulky Goods',
        descTr: 'Mobilya, saksı, bahçe mobilyası ve benzeri hacimli ürünlerin standart paketlerden farklı taşıma kurallarına ihtiyacı vardır. Ürün ölçüsü, ağırlığı, desisi ve teslimat bölgesine göre uygun kargo veya taşıma yöntemini belirleyen kurallar oluşturun.',
        descEn: 'Furniture, planters, patio sets, and large items require specialized carrier pipelines. Define custom logic that chooses the best carrier or shipping method based on measurements, weight, desi, and delivery address.',
        featuresTr: ['Ürün ölçüsü ve desi bilgisi', 'Taşıyıcı ve teslimat tipi seçimi', 'Paletli veya parçalı sevkiyat', 'Bölgesel teslimat kuralları', 'Kargo maliyet karşılaştırması', 'Siparişe özel paketleme talimatı'],
        featuresEn: ['Desi and volume metrics', 'Carrier and delivery matching', 'Palleted or split shipping', 'Regional dispatch rules', 'Cargo rate comparison', 'Order package details'],
        mockupType: 'desi'
      },
      {
        num: '02',
        tagTr: 'Depo Verimliliği',
        tagEn: 'Warehouse Efficiency',
        titleTr: 'Farklı Ürün Tiplerinde Depo Operasyonu',
        titleEn: 'Warehouse Operations for Diverse Sizes',
        descTr: 'Küçük dekoratif ürünlerden büyük mobilyalara kadar farklı ölçülerdeki ürünleri aynı operasyon içinde yönetin. Siparişleri depo, raf, ürün tipi veya hazırlama ekibine göre dağıtın.',
        descEn: 'Manage tiny decorative elements alongside huge modular furniture under one operational floor. Direct picking tasks based on warehouse zones, shelf types, weight groups, or custom preparation staff allocations.',
        featuresTr: ['Barkodlu ürün toplama', 'Toplama rotaları', 'Raf/lokasyon yönetimi', 'Siparişlerin ekiplere atanması', 'Konsolide paket/palet oluşturma', 'Toplama/paketleme doğrulaması'],
        featuresEn: ['Barcoded picking scan', 'Optimized picking paths', 'Shelf/bin allocations', 'Team job assignments', 'Consolidated pallet prep', 'Pack confirmation flow'],
        mockupType: 'desi'
      },
      {
        num: '03',
        tagTr: 'Stok Kontrolü',
        tagEn: 'Stock Control',
        titleTr: 'Sezonluk Talep ve Merkezi Stok Yönetimi',
        titleEn: 'Seasonal Demand & Stock Sync',
        descTr: 'Bahçe ürünleri ve sezonluk koleksiyonlarda oluşan ani talep değişikliklerini daha kontrollü yönetin. Tüm satış kanallarındaki stokları tek merkezden güncelleyin ve satış fazlası riskini azaltın.',
        descEn: 'Control sharp order spikes during spring/summer gardening seasons. Sync stock figures across all integrations instantly to keep supply chain levels optimized and reduce excess static catalog stock.',
        featuresTr: ['Çoklu depo stok takibi', 'Minimum stok uyarıları', 'Güvenli stok rezervasyonu', 'Sezonluk ürün etiketleri', 'Tedarikçi sipariş önerileri', 'Kanal bazlı stok tahsisi'],
        featuresEn: ['Multi-depot stock sync', 'Low-stock notifications', 'Reserve buffer stock', 'Seasonal product tags', 'Supplier purchase guides', 'Channel inventory caps'],
        mockupType: 'desi'
      },
      {
        num: '04',
        tagTr: 'Kalite Kontrol',
        tagEn: 'Quality Assurance',
        titleTr: 'Hassas Ürün Paketleme Kontrolü',
        titleEn: 'Fragile Product Packing Verification',
        descTr: 'Cam, seramik, aydınlatma ve bitki gibi hassas ürünler için ürün bazında paketleme talimatları tanımlayın. Depo personelinin sipariş hazırlarken doğru malzemeyi ve yöntemi kullanmasını sağlayın.',
        descEn: 'Create specific packaging workflows for fragile items like glass, ceramics, ceiling lights, or live plants. Instruct packagers on correct padding, box types, and double-boxing steps dynamically.',
        featuresTr: ['Kırılabilir ürün uyarıları', 'Ürün bazlı paketleme notları', 'Kutu/dolgu malzemesi seçimi', 'Paketleme kontrol listesi', 'Fotoğraflı paket doğrulama', 'Kullanıcı ve zaman kaydı'],
        featuresEn: ['Fragile item notifications', 'Product pack notes', 'Bubble-wrap selection', 'Packing checklists', 'Photo package receipts', 'User dispatch log'],
        mockupType: 'desi'
      },
      {
        num: '05',
        tagTr: 'Sevkiyat Yönetimi',
        tagEn: 'Shipment Management',
        titleTr: 'Akıllı Sevkiyat Planlama',
        titleEn: 'Intelligent Shipment Scheduling',
        descTr: 'Teslimat günü, ürün tipi, taşıyıcı kapasitesi ve müşteri bölgesine göre sevkiyat kuralları oluşturun. Gecikmeye açık veya hafta sonu teslim edilmemesi gereken ürünleri otomatik olarak uygun tarihe yönlendirin.',
        descEn: 'Configure rules sorting orders by shipping date, product dimensions, carrier weight capacities, and shipping zones. Delay weekend shipments of delicate plants or schedule bulk furniture carriage beforehand.',
        featuresTr: ['Kargo kesim saati kuralları', 'Hafta sonu teslimat kontrolü', 'Otomatik taşıyıcı seçimi', 'Planlanan sevkiyat tarihi', 'Müşteri durum bildirimleri', 'Takip numarası senkronizasyonu'],
        featuresEn: ['Cut-off time margins', 'Weekend delivery checker', 'Automated carrier choice', 'Scheduled ship dates', 'Customer status pings', 'Tracking sync automation'],
        mockupType: 'desi'
      },
      {
        num: '06',
        tagTr: 'Çok Kanallı Büyüme',
        tagEn: 'Omnichannel Scaling',
        titleTr: 'Çok Kanallı ve Sınır Ötesi Satış',
        titleEn: 'Omnichannel & Cross-border Sales',
        descTr: 'Web sitenizden ve farklı pazaryerlerinden gelen siparişleri aynı merkezde toplayın. Ürün, fiyat, stok ve sipariş durumlarının kanallar arasında tutarlı kalmasını sağlayın.',
        descEn: 'Unify incoming transactions from your custom shop and multiple local or global marketplaces in one screen. Ensure product content, prices, inventory, and order statuses stay perfectly in sync.',
        featuresTr: ['Aktif pazaryeri entegrasyonu', 'Ürün katalog senkronu', 'Fiyat güncelleme aracı', 'İade kontrol paneli', 'Kanal bazlı fatura şablonu', 'Sipariş durumu bildirimleri'],
        featuresEn: ['Active marketplace sync', 'Product catalog updates', 'Pricing management tools', 'Return control board', 'Channel invoice maps', 'Order status push'],
        mockupType: 'desi'
      }
    ],
    faqs: []
  },
  'fashion-and-apparel': {
    titleTr: 'Moda & Tekstil E-Ticaret Entegrasyonu | Alqora',
    titleEn: 'Fashion & Apparel E-Commerce Integration | Alqora',
    tagTr: 'Moda & Tekstil Sektörü İçin Alqora',
    tagEn: 'Alqora for Fashion & Apparel',
    h1Tr: 'Varyant, Renk ve Beden Karmaşasını Alqora ile Çözün',
    h1En: 'Unify Fashion Variants, Colors & Sizes in One Panel',
    descTr: 'Giyim, ayakkabı ve aksesuar gruplarındaki geniş renk, beden ve model varyasyonlarınızı tek bir katalogda yönetin. Sezon geçişlerindeki ani talep artışlarını, askılı depo süreçlerini ve yüksek hacimli iade operasyonlarını barkod entegrasyonuyla sıfır hataya indirin.',
    descEn: 'Manage extensive color, size, and style variants across clothing, shoes, and accessory groups in a central catalog. Minimize seasonal spikes, clothing hanger layouts, and high-volume reverse logistics returns via smart scanner flows.',
    metricsTr: [
      { label: 'Yeni Siparişler', val: '2,940', trend: '+28%' },
      { label: 'İade Oranı', val: '14.2%', trend: 'Kontrol Altında' },
      { label: 'Askılı Raf Stok', val: '8,420 Adet', trend: 'Düzenli' }
    ],
    metricsEn: [
      { label: 'New Orders', val: '2,940', trend: '+28%' },
      { label: 'Return Rate', val: '14.2%', trend: 'Controlled' },
      { label: 'Hanger Stock', val: '8,420 Items', trend: 'Organized' }
    ],
    solutions: [
      {
        num: '01',
        tagTr: 'Katalog Yönetimi',
        tagEn: 'Catalog Sync',
        titleTr: 'Beden, Renk ve Varyant Matrisi',
        titleEn: 'Size, Color & Variant Matrix',
        descTr: 'Bir tekstil ürününe ait onlarca beden ve renk kombinasyonunu ayrı ayrı listelemek yerine, tek ana ürün (Parent SKU) altında matris şeklinde yönetin ve pazaryerlerine tek tıklamayla gönderin.',
        descEn: 'Instead of manually duplicating items, structure dozens of color and size combinations under unified parent products. Sync variations directly to integrated storefronts in one click.',
        featuresTr: ['Parent-Child SKU yapısı', 'Beden tablosu eşleme', 'Renklere özel stok kartı', 'Hızlı varyant oluşturma', 'Varyant bazlı fiyatlandırma', 'Toplu ürün güncelleme'],
        featuresEn: ['Parent-Child SKU maps', 'Size chart allocations', 'Color stock records', 'Quick variation setup', 'Variant level pricing', 'Bulk catalog editor'],
        mockupType: 'variant'
      },
      {
        num: '02',
        tagTr: 'Depo Operasyonu',
        tagEn: 'Depot Workflows',
        titleTr: 'Askılı ve Raflı Depolama Yönetimi',
        titleEn: 'Hanging & Boxed Rack Storage',
        descTr: 'Katlanarak rafa konulması gereken tişört grupları ile askıda taşınması gereken ceket ve elbiseleri depo lokasyonlarına göre ayırarak toplama rotalarını optimize edin.',
        descEn: 'Organize warehouse layouts separating shelf-boxed items (like tees) from hanging assets (like jackets and suits). Optimize picking routes depending on rack zones.',
        featuresTr: ['Askılı raf lokasyonları', 'Katlı ürün kutulama planı', 'Barkodlu el terminalleri', 'Optimize toplama yolları', 'Ürün yerleşim kontrolü', 'Toplu lokasyon güncelleme'],
        featuresEn: ['Hanger shelf codes', 'Folded box layouts', 'Handheld scanner workflows', 'Optimized pick paths', 'Placement audits', 'Bulk bin relocations'],
        mockupType: 'variant'
      },
      {
        num: '03',
        tagTr: 'Lojistik & İade',
        tagEn: 'Logistics & Returns',
        titleTr: 'Yüksek İade Hacminin Hızlı Kontrolü',
        titleEn: 'Processing High-Volume Returns Fast',
        descTr: 'Moda sektörünün en kritik maliyetlerinden biri olan yüksek iadeleri hızla teslim alın. Barkod doğrulaması ile kalite kontrolü yapıp ürünü tekrar satışa kazandırın.',
        descEn: 'Accept returned fashion orders instantly. Scan barcodes to complete return quality checks (checking for wear/stains) and restock items back to active inventories in seconds.',
        featuresTr: ['İade kabul barkodlama', 'Kullanılmışlık / kusur kontrolü', 'Otomatik stok girişi', 'Müşteri iade onayı', 'Entegre muhasebe bakiye', 'İade sebep analizleri'],
        featuresEn: ['Return scan processing', 'Wear & defect inspection', 'Auto restock logs', 'Customer refund triggers', 'Ledger balance updates', 'Return reason analytics'],
        mockupType: 'variant'
      },
      {
        num: '04',
        tagTr: 'Sezonluk Kampanya',
        tagEn: 'Seasonal Sales',
        titleTr: 'Sezon Geçişleri ve Stok Rezervi',
        titleEn: 'Seasonal Shifts & Inventory Reserves',
        descTr: 'Yazlık/kışlık koleksiyon geçişlerinde oluşan ani sipariş dalgalanmalarını, ön satış siparişlerini ve kritik stok seviyelerini kanal bazlı rezervasyonla kontrol altında tutun.',
        descEn: 'Prevent overselling issues during seasonal changes. Reserve batch counts specifically for pre-orders or certain marketing campaigns across active integrations.',
        featuresTr: ['Ön satış stok tahsisi', 'Güvenli stok tamponları', 'Sezonluk ürün etiketleri', 'Fiyat kampanyası senkronu', 'Geri sayım indirim kuralları', 'Kanal bazlı limitler'],
        featuresEn: ['Pre-order stock caps', 'Safety stock buffers', 'Seasonal tag labels', 'Campaign discount sync', 'Countdown price rules', 'Channel restrictions'],
        mockupType: 'variant'
      },
      {
        num: '05',
        tagTr: 'Kargo Hızı',
        tagEn: 'Shipping Speeds',
        titleTr: 'Hızlı Paketleme ve Fatura Basımı',
        titleEn: 'Express Packing & Shipping Labels',
        descTr: 'Siparişler onaylandığı anda kargo etiketlerini ve e-arşiv faturalarını toplu şekilde yazdırın. Paketleme istasyonunda doğru beden ve renkteki ürünün konulduğunu doğrulayın.',
        descEn: 'Print shipping labels and e-invoices in batches immediately upon purchase approvals. Verify that correct variant sizes and colors are enclosed during packing scan steps.',
        featuresTr: ['Toplu kargo etiketi', 'E-Arşiv fatura entegrasyonu', 'İstasyon barkod doğrulaması', 'Paket ağırlık doğrulaması', 'Otomatik desi atama', 'Kurye teslimat listeleri'],
        featuresEn: ['Batch label generation', 'Digital invoice sync', 'Station variant checkers', 'Package scale validations', 'Automatic desi assignment', 'Courier handover printouts'],
        mockupType: 'variant'
      },
      {
        num: '06',
        tagTr: 'Pazaryeri Eşleşme',
        tagEn: 'Marketplace Sync',
        titleTr: 'Çok Kanallı Moda Pazaryerleri',
        titleEn: 'Omnichannel Fashion Marketplace Flows',
        descTr: 'Trendyol, Hepsiburada, Amazon ve Shopify altyapılarında ürün varyantlarınızı kusursuz şekilde eşleştirin. Stok seviyelerini anlık güncelleyin.',
        descEn: 'Map fashion catalog variations correctly across Trendyol, Hepsiburada, Amazon, and Shopify. Run real-time quantity updates to avoid cancellation fees.',
        featuresTr: ['Pazaryeri varyant eşleşmesi', 'Katalog senkronizasyonu', 'Anlık fiyat kuralları', 'Hatalı eşleşme uyarıları', 'İade kontrol paneli', 'Kanal bazlı fatura şablonu'],
        featuresEn: ['Variation mapping matrix', 'Catalog sync pipelines', 'Real-time price rules', 'Mapping warning alerts', 'Return monitor panel', 'Custom channel layouts'],
        mockupType: 'variant'
      }
    ],
    faqs: []
  },
  'cosmetics-and-personal-care': {
    titleTr: 'Kozmetik & Kişisel Bakım Entegrasyonu | Alqora',
    titleEn: 'Cosmetics & Personal Care Integration | Alqora',
    tagTr: 'Kozmetik Sektörü İçin Alqora',
    tagEn: 'Alqora for Cosmetics',
    h1Tr: 'Kozmetik Depo ve Lot Takibinde Sıfır Hata',
    h1En: 'Zero-Error Cosmetic Depot & Lot Tracking',
    descTr: 'Şampuan, krem, parfüm ve makyaj gruplarındaki son kullanma tarihlerini, parti (lot/batch) numaralarını ve sağlık regülasyonlarını tek merkezden takip edin. Kırılabilir sıvı paketleme süreçlerini ve setli/kampanyalı ürün envanterlerini barkodla hatasız yönetin.',
    descEn: 'Monitor expiration dates, lot/batch numbers, and sanitary regulations for beauty, cream, perfume, and makeup products under one panel. Manage liquid packing, fragile glassware, and bundle hamper inventories.',
    metricsTr: [
      { label: 'Bugünkü Siparişler', val: '1,940', trend: '+18%' },
      { label: 'SKT Uyarısı', val: '0 Ürün', trend: 'Güvenli' },
      { label: 'ÜTS Bildirimi', val: 'Aktif', trend: 'Uyumlu' }
    ],
    metricsEn: [
      { label: 'Today\'s Orders', val: '1,940', trend: '+18%' },
      { label: 'Expiry Alerts', val: '0 SKU', trend: 'Safe' },
      { label: 'Regulatory Logs', val: 'Active', trend: 'Compliant' }
    ],
    solutions: [
      {
        num: '01',
        tagTr: 'Lot Takibi',
        tagEn: 'Batch Control',
        titleTr: 'Parti (Lot / Batch) No ve Son Kullanma Tarihi',
        titleEn: 'Lot / Batch Number & Expiration Auditing',
        descTr: 'Her üretim serisine ait lot numaralarını sisteme işleyin. Son kullanma tarihi yaklaşan ürünlerin satış kanallarından otomatik kaldırılmasını sağlayın.',
        descEn: 'Register lot and batch records upon incoming receipt. Automatically flag and pull items approaching expiry from active marketplaces to maintain quality.',
        featuresTr: ['Parti (Lot) eşleme', 'SKT izleme bildirimleri', 'FIFO (İlk Giren İlk Çıkır) kuralı', 'Lot bazlı stok takibi', 'Kanal otomatik pasifleşme', 'Kalite kontrol kayıtları'],
        featuresEn: ['Lot code tracking', 'Expiry warning alerts', 'FIFO picking flow rules', 'Batch inventory lists', 'Channel auto-disable', 'Sanitary audit logs'],
        mockupType: 'expiry'
      },
      {
        num: '02',
        tagTr: 'Regülasyonlar',
        tagEn: 'Compliance',
        titleTr: 'Bakanlık ÜTS Takip Entegrasyon Altyapısı',
        titleEn: 'Ministry ÜTS Regulatory Compliance',
        descTr: 'Sağlık Bakanlığı Ürün Takip Sistemi (ÜTS) bildirimlerinizi sisteme kaydedin. Depo giriş ve çıkışlarındaki bildirim süreçlerini kolaylaştırın.',
        descEn: 'Register Health Ministry ÜTS codes. Keep regulatory trace logs clean, aligning warehouse stock movements with mandatory chemical registry compliance records.',
        featuresTr: ['ÜTS barkod eşleme', 'Giriş/Çıkış bildirim kaydı', 'Lot-ÜTS uyumluluğu', 'Hızlı bildirim raporları', 'Kritik uyarı paneli', 'Otomatik yasal raporlama'],
        featuresEn: ['ÜTS barcode mapping', 'Inbound/Outbound logs', 'Lot compliance check', 'Trace reporting tools', 'Compliance warning grid', 'Auto legal printouts'],
        mockupType: 'expiry'
      },
      {
        num: '03',
        tagTr: 'Hassas Lojistik',
        tagEn: 'Fragile Shipping',
        titleTr: 'Hassas Cam ve Sıvı Paketleme Kontrolü',
        titleEn: 'Fragile Liquid & Glass Packing',
        descTr: 'Cam parfümler ve dökülme riski olan şampuan/sıvı ürünler için paketleme talimatları oluşturun. Depo personelini doğru sarım malzemesi için uyarın.',
        descEn: 'Set packaging workflows for delicate perfume glass bottles or liquids prone to spilling. Instruct operators to apply tape seals and shrink wraps on capping joints.',
        featuresTr: ['Dökülme/kırılma uyarıları', 'Sıvı koruyucu bantlama', 'Pıt-pıt naylon talimatları', 'Paketleme istasyonu kamerası', 'Kutu ölçü optimizasyonu', 'Paket doğrulaması'],
        featuresEn: ['Spillage warning alerts', 'Cap tape seal guidelines', 'Bubble wrap instructions', 'Packing station cameras', 'Box size optimization', 'Package weight check'],
        mockupType: 'expiry'
      },
      {
        num: '04',
        tagTr: 'Kampanya Yönetimi',
        tagEn: 'Bundle Management',
        titleTr: 'Set ve Sepet (Bundle) Ürün Yapılandırması',
        titleEn: 'Product Bundle & Hampers Config',
        descTr: 'Şampuan ve kremleri birleştirerek oluşturduğunuz "Kozmetik Bakım Seti" gibi sanal setleri tek tıklamayla tanımlayın. Sipariş geldiğinde stokları bileşen bazında düşürün.',
        descEn: 'Create virtual beauty kit bundles (e.g. shampoo + conditioner box) in one click. Decrease stock levels of individual component SKUs automatically as sales drop.',
        featuresTr: ['Sanal ürün (Bundle) eşleme', 'Bileşen bazlı stok takibi', 'Set içi ürün ayrıştırma', 'Toplu set oluşturucu', 'Kampanyalı fiyat senkronu', 'Kanal bazlı stok tahsisi'],
        featuresEn: ['Virtual bundle mappings', 'Component SKU inventory', 'Set component picking', 'Bulk bundle setup tools', 'Campaign promo sync', 'Channel stock quotas'],
        mockupType: 'expiry'
      },
      {
        num: '05',
        tagTr: 'FMCG Hızı',
        tagEn: 'FMCG Throughput',
        titleTr: 'Yüksek Hacimli Hızlı Sipariş Akışı',
        titleEn: 'High-Volume Fast FMCG Flows',
        descTr: 'Kozmetik ve hızlı tüketim sektöründeki günlük binlerce siparişi tek tıkla işleme alın. Toplu faturalandırma ve kargo süreçlerini otomatikleştirin.',
        descEn: 'Process thousands of daily cosmetic transactions without human lag. Automate invoicing and shipping label downloads in batches.',
        featuresTr: ['Toplu e-fatura kesimi', 'Otomatik kargo barkodu', 'Akıllı kesim saati kuralları', 'Hafta sonu kurye atama', 'Müşteri durum bildirimleri', 'Takip kodu senkronu'],
        featuresEn: ['Batch invoice printing', 'Instant label printing', 'Smart cut-off margins', 'Weekend carrier setup', 'Customer notifications', 'Tracking push code'],
        mockupType: 'expiry'
      },
      {
        num: '06',
        tagTr: 'Çoklu Depolama',
        tagEn: 'Multi-Warehouse',
        titleTr: 'Çoklu Depo Son Kullanma Kontrolleri',
        titleEn: 'Multi-Depot Expiration Audits',
        descTr: 'Farklı şehirlerdeki depolarınızda yer alan ürünlerin raf ömürlerini merkezi olarak takip edin. Süresi yaklaşan ürünleri öncelikli çıkartın.',
        descEn: 'Unify shelf life trackers across different physical locations. Ensure warehouses follow FIFO models prioritizing items closest to expiration dates.',
        featuresTr: ['Çoklu depo SKT takibi', 'Merkezi stok raporlama', 'Depolar arası lot transferi', 'Kritik ürün alarmı', 'Gelişmiş analitik raporlar', 'Maliyet kontrol paneli'],
        featuresEn: ['Multi-site expiry tracker', 'Centralized inventory logs', 'Inter-depot batch transfers', 'Critical date alerts', 'Advanced analytics', 'Loss cost control board'],
        mockupType: 'expiry'
      }
    ],
    faqs: []
  },
  'electronics': {
    titleTr: 'Elektronik E-Ticaret Entegrasyonu | Alqora',
    titleEn: 'Electronics E-Commerce Integration | Alqora',
    tagTr: 'Elektronik Sektörü İçin Alqora',
    tagEn: 'Alqora for Electronics',
    h1Tr: 'Elektronikte Seri No ve IMEI Takip Sistemi',
    h1En: 'Serial Number & IMEI Trackers for Electronics',
    descTr: 'Telefon, bilgisayar, tablet ve akıllı saat gruplarındaki seri numaralarını (S/N) ve IMEI kodlarını depo girişinden kargo çıkışına kadar izleyin. Yüksek değerli ürün lojistiğinde çalınma ve kayıp riskini azaltın, garanti süreçlerini otomatikleştirin.',
    descEn: 'Trace serial numbers (SN) and IMEI registers from inbound delivery to shipping handover. Reduce inventory shrinkage and theft risks in premium consumer electronics, automating product warranty registrations.',
    metricsTr: [
      { label: 'Siparişler (Bugün)', val: '342', trend: '+8%' },
      { label: 'IMEI Girişleri', val: '120 Kod', trend: 'Tümü İzleniyor' },
      { label: 'Ort. Ürün Değeri', val: '7,400 TL', trend: 'Yüksek Değerli' }
    ],
    metricsEn: [
      { label: 'Today\'s Orders', val: '342', trend: '+8%' },
      { label: 'IMEI Logs', val: '120 Items', trend: 'Fully Traced' },
      { label: 'Avg. Cart Value', val: '$320', trend: 'Premium' }
    ],
    solutions: [
      {
        num: '01',
        tagTr: 'Seri No Takibi',
        tagEn: 'SN Tracking',
        titleTr: 'Seri Numarası (S/N) ve IMEI İzleme',
        titleEn: 'Serial Number (SN) & IMEI Verification',
        descTr: 'Her elektronik cihazın kendine has seri numarasını ve IMEI kodunu sisteme kaydedin. Yanlış ürün gönderimlerini ve sahte iade girişimlerini önleyin.',
        descEn: 'Scan and bind unique serial numbers and IMEI keys to specific customer profiles during packaging. Block fraudulent warranty returns instantly.',
        featuresTr: ['IMEI/SN barkod tarama', 'Kutu-cihaz seri no eşleme', 'Garanti başlangıç kaydı', 'Sahte iade engelleme', 'Geriye dönük izlenebilirlik', 'Teknik servis log kaydı'],
        featuresEn: ['IMEI/SN barcode scan', 'Box-device key binding', 'Warranty start records', 'Fraudulent return blocker', 'Reverse history trace', 'Tech repairs logging'],
        mockupType: 'imei'
      },
      {
        num: '02',
        tagTr: 'Güvenlik',
        tagEn: 'Asset Security',
        titleTr: 'Yüksek Değerli Ürün Lojistiği ve Güvenlik',
        titleEn: 'High-Value Logistics & Safety Controls',
        descTr: 'Telefon ve tablet gibi pahalı ürünlerin depo içi hareketlerini, paketleme adımlarını ve kurye teslimatlarını kameralı paketleme onay sistemimizle kontrol edin.',
        descEn: 'Monitor inventory movement for expensive high-risk goods. Use camera-assisted packing verification checkpoints to ensure correct handover.',
        featuresTr: ['Kamerayla paket kaydı', 'Özel güvenlik kafesi alanları', 'Yetkili personel atama', 'Çift doğrulama sistemi', 'Lojistik hasar raporlama', 'Değerli ürün kargo sigorta'],
        featuresEn: ['Camera video record logs', 'Cage inventory zones', 'Authorized staff access', 'Double validator checks', 'Cargo damage auditing', 'Cargo value insurance'],
        mockupType: 'imei'
      },
      {
        num: '03',
        tagTr: 'Aksesuar Yönetimi',
        tagEn: 'Accessories',
        titleTr: 'Aksesuar ve Yedek Parça Kataloğu Eşleme',
        titleEn: 'Accessories & Spare Parts Matching',
        descTr: 'Ana cihazların (örn. telefon) yanında satılan kılıf, şarj aleti, kulaklık gibi tamamlayıcı aksesuarları stok kurallarıyla otomatik olarak toplayıp paketleyin.',
        descEn: 'Group primary devices with complementary items (chargers, cases, adaptors). Create system rules that prompt pickers to compile complete component bundles.',
        featuresTr: ['Tamamlayıcı ürün kuralları', 'Aksesuar stok alarmı', 'Çapraz satış (Upsell) senkronu', 'Paket içi aksesuar check', 'Katalog uyumluluk etiketleri', 'Raf yerleşim planı'],
        featuresEn: ['Associated product rules', 'Accessory stock alert', 'Cross-sell (Upsell) sync', 'In-package accessory check', 'Catalog compatibility tags', 'Shelf layout plan'],
        mockupType: 'imei'
      },
      {
        num: '04',
        tagTr: 'Kalite & Servis',
        tagEn: 'Returns & Repairs',
        titleTr: 'Servis ve İade Cihaz Test Süreçleri',
        titleEn: 'Returns Diagnostic & QC Testing',
        descTr: 'İade gelen cep telefonu ve tabletlerin çalışırlık testlerini, kozmetik kusurlarını ve seri numaralarını kontrol ederek iade kabul/red kararlarını yönetin.',
        descEn: 'Perform quick diagnostic checks on returned consumer electronics. Log wear indicators, button functionalities, and serial matching before refund approvals.',
        featuresTr: ['Kozmetik kusur kontrolü', 'Cihaz açılış/çalışma onayı', 'Kullanıcı hesabı sıfırlama check', 'İade raporu pdf oluşturma', 'Otomatik iade red belgesi', 'Teknik servis entegrasyonu'],
        featuresEn: ['Cosmetic wear check', 'System boot-up validation', 'User account reset audit', 'Return PDF report printer', 'Auto return rejection print', 'Tech repair integrations'],
        mockupType: 'imei'
      },
      {
        num: '05',
        tagTr: 'Fiyat Dinamikliği',
        tagEn: 'Dynamic Pricing',
        titleTr: 'Anlık Fiyat ve Stok Güncellemesi',
        titleEn: 'Real-time Price & Stock Updates',
        descTr: 'Döviz kuru dalgalanmalarına ve kampanya dönemlerine göre elektronik ürünlerinizin fiyatlarını tüm kanallarda anlık olarak güncelleyin.',
        descEn: 'Update pricing tiers across all sales integrations instantly to adjust for exchange rates, raw cost spikes, and seasonal electronics campaigns.',
        featuresTr: ['Kur bazlı dinamik fiyat', 'Kampanyalı fiyat senkronu', 'Minimum kâr marjı kontrolü', 'Komisyon hesaplama aracı', 'Pazaryeri anlık güncelleme', 'Toplu fiyat editörü'],
        featuresEn: ['Currency rate dynamic pricing', 'Campaign discount sync', 'Minimum profit margins', 'Commission calculator', 'Marketplace api updates', 'Bulk pricing editor'],
        mockupType: 'imei'
      },
      {
        num: '06',
        tagTr: 'Paket Kontrolü',
        tagEn: 'Verification',
        titleTr: 'Kutu İçi Barkod ve Seri No Doğrulaması',
        titleEn: 'In-Box Serial Code Validation',
        descTr: 'Paketleme aşamasında ürün kutusunun üzerindeki barkod ile faturadaki seri numarasının %100 eşleştiğini el terminaliyle doğrulayın.',
        descEn: 'Verify that the serial number bound to the invoice matches the exact device enclosed inside the physical package using scan validations.',
        featuresTr: ['Çift barkod okutma', 'Fatura-ürün seri no kontrolü', 'Yanlış kutulama engelleme', 'Otomatik e-fatura iletimi', 'Kargo takip no basımı', 'Sevkiyat zaman kaydı'],
        featuresEn: ['Double barcode scanner', 'Invoice serial code audit', 'Mismatched box prevention', 'E-invoice transmission', 'Tracking label printing', 'Dispatch timestamp logging'],
        mockupType: 'imei'
      }
    ],
    faqs: []
  },
  'automotive-spare-parts': {
    titleTr: 'Otomotiv Yedek Parça Entegrasyonu | Alqora',
    titleEn: 'Automotive Spare Parts Integration | Alqora',
    tagTr: 'Otomotiv Sektörü İçin Alqora',
    tagEn: 'Alqora for Automotive Parts',
    h1Tr: 'OEM ve Çapraz Kod Uyumlu Yedek Parça Yönetimi',
    h1En: 'OEM & Cross-Reference Spare Parts WMS Sync',
    descTr: 'Yedek parça sektöründeki binlerce OEM kodunu, çapraz (cross) referans kodlarını ve araç marka-model uyumluluklarını tek merkezde yönetin. Hacimli amortisörlerden küçük bujilere kadar karmaşık raf adresleme ve kargo süreçlerini otomatikleştirin.',
    descEn: 'Govern thousands of OEM codes, cross-reference listings, and vehicle compatibility charts in a single database. Streamline warehouse layouts and freight paths for heavy items alongside small components.',
    metricsTr: [
      { label: 'Siparişler (Bugün)', val: '620', trend: '+12%' },
      { label: 'OEM Eşleşme Oranı', val: '99.8%', trend: 'Yüksek Uyum' },
      { label: 'Ağır Kargo (Desi)', val: '42 Sipariş', trend: 'Lojistik' }
    ],
    metricsEn: [
      { label: 'Today\'s Orders', val: '620', trend: '+12%' },
      { label: 'OEM Match Rate', val: '99.8%', trend: 'Highly Accurate' },
      { label: 'Heavy Cargo (Desi)', val: '42 Orders', trend: 'Logistics' }
    ],
    solutions: [
      {
        num: '01',
        tagTr: 'OEM & Çapraz Kod',
        tagEn: 'OEM & Cross Code',
        titleTr: 'OEM ve Çapraz Kod Eşleme Altyapısı',
        titleEn: 'OEM & Cross-Reference Mapping Layout',
        descTr: 'Yedek parça ürün kartlarında OEM numaralarını, üretici kodlarını ve çapraz kodları tanımlayın. Alıcılar hangi kodu girerse girsin doğru stok kartını bulun.',
        descEn: 'Register OEM codes, manufacturer serials, and cross-reference keys in Alqora. Ensure search queries resolve to correct active warehouse SKU items.',
        featuresTr: ['OEM kod kütüphanesi', 'Üretici marka eşleme', 'Çapraz kod (Cross) tablosu', 'Araç model uyumluluk listesi', 'Toplu kod import', 'Gelişmiş arama dizini'],
        featuresEn: ['OEM library directory', 'Brand code matching', 'Cross-reference grid', 'Vehicle model list', 'Bulk import tools', 'Advanced search index'],
        mockupType: 'oem'
      },
      {
        num: '02',
        tagTr: 'Hacimli Lojistik',
        tagEn: 'Freight Path',
        titleTr: 'Hacimli ve Ağır Lojistik Yönetimi',
        titleEn: 'Heavy & Bulky Freight Logistics',
        descTr: 'Amortisör, jant, motor parçaları gibi ağır desili ürünleri, standart kargo firmaları yerine paletli taşımacılık yapan lojistik firmalarına otomatik atayın.',
        descEn: 'Direct heavy spare parts (rims, engine blocks, brake discs) to freight transport networks instead of standard envelope delivery services automatically.',
        featuresTr: ['Ürün ağırlık/desi tespiti', 'Lojistik firma kuralları', 'Paletli taşıma atama', 'Kargo desi karşılaştırma', 'Ağır yük kargo etiketleri', 'Kurye teslimat belgeleri'],
        featuresEn: ['Desi/weight analysis', 'Logistics network rules', 'Freight pallet assignment', 'Carrier quote compares', 'Heavy parcel stickers', 'Courier manifest prints'],
        mockupType: 'oem'
      },
      {
        num: '03',
        tagTr: 'Depo Raf Sistemi',
        tagEn: 'Racking Zones',
        titleTr: 'Raf/Lokasyon ve Adresleme Sistemi',
        titleEn: 'Dynamic Shelf Location & Bin Maps',
        descTr: 'Küçük contalar, bujiler ile büyük karoser parçalarını depo yerleşim planında doğru katlara ve raflara yerleştirip, toplama rotalarını barkodla kısaltın.',
        descEn: 'Sort small spark plugs and massive bumpers into designated warehouse zones. Optimize picker routes using barcode validations on terminals.',
        featuresTr: ['Raf-Kat-Göz adresleme', 'Küçük parça çekmeceleri', 'Büyük parça palet alanları', 'Toplama yolu optimizasyonu', 'Barkod doğrulama', 'Lokasyon doluluk raporları'],
        featuresEn: ['Bin-level shelf maps', 'Small part compartments', 'Heavy item bays', 'Pick route optimization', 'Barcode scan audit', 'Bin volume analytics'],
        mockupType: 'oem'
      },
      {
        num: '04',
        tagTr: 'Çoklu Depolama',
        tagEn: 'Multi-Warehouse',
        titleTr: 'Çoklu Depo Parça Yönetimi',
        titleEn: 'Multi-Site Spare Part Management',
        descTr: 'Farklı konumlardaki yedek parça depolarınızı tek bir panelde birleştirin. Siparişi müşteriye en yakın lokasyondan kargolayacak kurallar tanımlayın.',
        descEn: 'Combine multiple spare parts depots under a unified dashboard. Set rules routing order fulfillment to the closest warehouse to speed up shipping.',
        featuresTr: ['Çoklu depo stok takibi', 'En yakın depodan sevkiyat', 'Depolar arası transfer emirleri', 'Stok yetersizliğinde otomatik yönlendirme', 'Depo bazlı envanter raporu', 'Merkezi stok kontrolü'],
        featuresEn: ['Multi-site stock sync', 'Proximity routing rules', 'Inter-depot transfer orders', 'Out-of-stock redirection', 'Depot level inventory reports', 'Centralized stock monitor'],
        mockupType: 'oem'
      },
      {
        num: '05',
        tagTr: 'Tedarikçi Akışı',
        tagEn: 'Dropshipping Flow',
        titleTr: 'Tedarikçi ve XML / API Veri Akışı',
        titleEn: 'Supplier XML / API Dropshipping Sync',
        descTr: 'Distribütörlerden veya üreticilerden gelen anlık stok/fiyat XML ve API verilerini Alqora’ya bağlayın, dropshipping operasyonlarını hatasız sürdürün.',
        descEn: 'Import real-time inventory and pricing XML/API feeds from wholesale spare parts distributors. Control dropshipping without selling stale stock.',
        featuresTr: ['Anlık XML import', 'Otomatik stok güncelleme', 'Tedarikçi fiyat marjı hesabı', 'Pazaryeri otomatik aktarım', 'Distribütör sipariş iletimi', 'Hatalı veri engelleme'],
        featuresEn: ['XML import feeds', 'Auto inventory checks', 'Wholesale price markup', 'Marketplace upload tools', 'Distributor order forwarding', 'Error data checking'],
        mockupType: 'oem'
      },
      {
        num: '06',
        tagTr: 'Lojistik Karşılaştırma',
        tagEn: 'Logistics Rates',
        titleTr: 'Sipariş Bazlı Kargo Maliyeti Karşılaştırma',
        titleEn: 'Order-Level Carrier Freight Compare',
        descTr: 'Yedek parça siparişinizin ağırlık ve ölçü bilgilerine göre anlaşmalı olduğunuz kargo şirketlerinin fiyatlarını karşılaştırıp en ucuz taşıyıcıyı atayın.',
        descEn: 'Evaluate negotiated rates across shipping carriers dynamically based on order dimensions. Route parcels through the most cost-effective provider.',
        featuresTr: ['Kargo fiyat entegrasyonu', 'En ucuz kargo kuralı', 'Desi bazlı maliyet hesabı', 'Kargo fatura kontrolü', 'Lojistik performans takibi', 'Maliyet azaltma analizleri'],
        featuresEn: ['Carrier rate integrations', 'Cheapest carrier rules', 'Desi-based cost analysis', 'Shipping invoice checks', 'Logistics KPI monitors', 'Cost reduction reporting'],
        mockupType: 'oem'
      }
    ],
    faqs: []
  },
  'food-and-fmcg': {
    titleTr: 'Gıda & Hızlı Tüketim Entegrasyonu | Alqora',
    titleEn: 'Food & FMCG Integration | Alqora',
    tagTr: 'Gıda & Hızlı Tüketim Sektörü İçin Alqora',
    tagEn: 'Alqora for Food & FMCG',
    h1Tr: 'Soğuk Zincir ve SKT Takipli Gıda E-Ticaret Otomasyonu',
    h1En: 'Cold Chain & Expiration Monitoring for Food E-Commerce',
    descTr: 'Taze gıda, kuru gıda, içecek ve hızlı tüketim ürünlerindeki son kullanma tarihlerini (SKT), parti lot kodlarını ve soğuk zincir taşıma gereksinimlerini Alqora ile hatasız yönetin. FIFO kuralına göre toplama rotaları oluşturun ve bölgesel hızlı teslimat kuralları tanımlayın.',
    descEn: 'Manage expiration dates, lot batch tags, and cold chain shipping requirements for fresh food, beverages, and FMCG lines. Organize picking paths using FIFO rules and set regional express delivery models.',
    metricsTr: [
      { label: 'Siparişler (Bugün)', val: '2,400', trend: '+22%' },
      { label: 'Soğuk Zincir İzleme', val: 'Normal', trend: 'Isı Kontrollü' },
      { label: 'SKT Uyarısı', val: '0 Ürün', trend: 'Güvenli' }
    ],
    metricsEn: [
      { label: 'Today\'s Orders', val: '2,400', trend: '+22%' },
      { label: 'Cold Chain Monitor', val: 'Normal', trend: 'Temps OK' },
      { label: 'Expiry Alerts', val: '0 SKU', trend: 'Safe' }
    ],
    solutions: [
      {
        num: '01',
        tagTr: 'Soğuk Zincir',
        tagEn: 'Cold Chain',
        titleTr: 'Soğuk Zincir Lojistiği ve Takibi',
        titleEn: 'Cold Chain Logistics Monitoring',
        descTr: 'Taze ve donuk gıda gruplarının depo içi ısı kontrollü alanlarda takibini ve soğuk zincir lojistik partnerlerine (örn. Frigo taşıma) otomatik yönlendirilmesini sağlayın.',
        descEn: 'Track frozen and temperature-controlled food lines within cool zones. Auto-route orders containing perishables to specialized refrigerated logistics networks.',
        featuresTr: ['Isı kontrollü depo bölgesi', 'Soğuk zincir kargo entegrasyonu', 'Sıcaklık alarm eşikleri', 'Isı yalıtımlı paketleme check', 'Kuru buz/jel paket talimatları', 'Hızlı teslimat etiketleri'],
        featuresEn: ['Refrigerated warehouse zones', 'Cold chain courier matching', 'Temperature threshold alerts', 'Insulated box packing audits', 'Dry ice/gel pack instructions', 'Express shipping tags'],
        mockupType: 'coldchain'
      },
      {
        num: '02',
        tagTr: 'Raf Ömrü',
        tagEn: 'Shelf Life',
        titleTr: 'Raf Ömrü ve FIFO Stok Dağıtımı',
        titleEn: 'Shelf Life & FIFO Stock Allocation',
        descTr: 'Gıda ürünlerinin son kullanma tarihlerini izleyin. Depo içi toplama emirlerini "İlk Giren İlk Çıkır" (FIFO) modeline göre verip taze kalmasını sağlayın.',
        descEn: 'Trace expiry dates for canned, dry, or fresh foods. Configure picking tasks following FIFO strategies to dispatch items closest to expiration first.',
        featuresTr: ['SKT bazlı envanter', 'FIFO toplama rotası', 'Tarihi geçen ürün pasifleşme', 'Minimum raf ömrü kontrolü', 'Otomatik tedarik önerisi', 'Parti bazlı lot izleme'],
        featuresEn: ['Expiry catalog lists', 'FIFO picker layouts', 'Expired item auto-disable', 'Minimum shelf life limits', 'Auto replenishment guides', 'Batch lot trace codes'],
        mockupType: 'coldchain'
      },
      {
        num: '03',
        tagTr: 'Paketleme Hızı',
        tagEn: 'Packing Speed',
        titleTr: 'Hızlı Tüketim (FMCG) ve Paketleme Kuralları',
        titleEn: 'FMCG High-Speed Packing Workflows',
        descTr: 'Günlük çok yüksek hacimlere ulaşan hızlı tüketim siparişlerini, toplu fatura, toplu kargo barkodu ve el terminali doğrulamaları ile ışık hızında hazırlayın.',
        descEn: 'Fulfil high-volume FMCG transactions rapidly. Enable pickers to use scanning checklists, batch invoice printers, and automated label drops to avoid shipping lag.',
        featuresTr: ['Işık hızında faturalandırma', 'Toplu barkod yazdırıcı', 'Paketleme doğrulamaları', 'Kutu dolgu optimizasyonu', 'Ağırlık limit kontrolü', 'Zaman damgalı sevkiyat'],
        featuresEn: ['Instant digital invoices', 'Batch label printers', 'Scanner packing checks', 'Box padding optimization', 'Weight limit controls', 'Timestamped carrier handover'],
        mockupType: 'coldchain'
      },
      {
        num: '04',
        tagTr: 'Bölgesel Lojistik',
        tagEn: 'Express Logistics',
        titleTr: 'Bölgesel ve Saatlik Hızlı Teslimat',
        titleEn: 'Regional & Same-Day Express Routing',
        descTr: 'Sipariş adresinin konumuna göre saatlik veya aynı gün teslimat yapan kurye firmalarını (örn. motor kurye) otomatik atayacak lojistik kuralları tanımlayın.',
        descEn: 'Map zip codes to local same-day courier dispatch systems (e.g. motor cycle couriers) to fulfill hot grocery deliveries within a couple of hours.',
        featuresTr: ['Lokasyon bazlı taşıyıcı', 'Saatlik kurye entegrasyonu', 'Kesim saati dinamikleri', 'Hızlı teslimat SMS uyarıları', 'Kurye takip link senkronu', 'Bölgesel stok tahsisi'],
        featuresEn: ['Location-based carrier maps', 'Hourly courier links', 'Cut-off time margins', 'Express delivery SMS alerts', 'Courier live tracking sync', 'Regional stock allocations'],
        mockupType: 'coldchain'
      },
      {
        num: '05',
        tagTr: 'Kampanyalar',
        tagEn: 'Bundles',
        titleTr: 'Set ve Sepet Kampanya Yönetimi',
        titleEn: 'Hamper & Gift Bundle Configurations',
        descTr: 'Farklı gıda ürünlerini birleştirerek oluşturduğunuz "Ramazan Kolisi" veya "Hediye Sepeti" gibi kampanya paketlerini merkezi stoktan otomatik düşürün.',
        descEn: 'Define food baskets, snack boxes, or holiday gift hampers in one dashboard. Sync component inventories automatically upon sales of composite bundle sets.',
        featuresTr: ['Kampanya paketi eşleme', 'Merkezi envanter senkronu', 'Bileşen stok bloke sistemi', 'Çoklu ürün fiyat kuralları', 'Otomatik sepet indirimleri', 'Kanal bazlı stok limitleri'],
        featuresEn: ['Holiday hamper mapping', 'Central inventory sync', 'Component quantity hold', 'Composite product price rules', 'Auto basket discounts', 'Channel inventory caps'],
        mockupType: 'coldchain'
      },
      {
        num: '06',
        tagTr: 'İade & İmha',
        tagEn: 'Disposal',
        titleTr: 'İade Kabul ve İmha Süreçleri',
        titleEn: 'Groceries Return Diagnostics & Disposal',
        descTr: 'Müşterilerden iade dönen gıda ürünlerinin son kullanma tarihlerini ve paket bütünlüklerini kontrol ederek imha veya yeniden stok kararlarını yönetin.',
        descEn: 'Examine returned food and grocery goods carefully. Check cold chain integrity and expiry dates before logging restock or disposal records.',
        featuresTr: ['İade paket hasar kontrolü', 'SKT aşım imha onay formu', 'İmha muhasebe gider kaydı', 'Tekrar satış stok onayı', 'İade sebep istatistikleri', 'Gıda güvenliği kayıtları'],
        featuresEn: ['Return package seal check', 'Expiry disposal forms', 'Disposal ledger entry', 'Restock approval tools', 'Return category reports', 'Food safety compliance logs'],
        mockupType: 'coldchain'
      }
    ],
    faqs: []
  }
};

export default function SolutionDetail() {
  const { isAuthenticated } = useAuth();
  const params = useParams();
  
  const locale = (params.locale as string) || 'tr';
  const slug = (params.slug as string) || 'home-and-garden';
  const isTr = locale.startsWith('tr');

  // Find data for this sector, fallback to home-and-garden if not found
  const sectorData = SECTOR_DATA_MAP[slug] || SECTOR_DATA_MAP['home-and-garden'];

  // Construct dynamic FAQ list based on current sector to make it personalized!
  const sssItems = sectorData.faqs.length > 0 ? sectorData.faqs : [
    {
      qTr: `Alqora bu sektör entegrasyonunda hangi pazaryerleriyle çalışır?`,
      qEn: `Which marketplaces does Alqora support for this industry?`,
      aTr: 'Alqora; Trendyol, Hepsiburada, Amazon, N11 ve ÇiçekSepeti gibi Türkiye’nin popüler pazaryerleriyle tam uyumlu stok, sipariş ve fiyat entegrasyonu sunar. Shopify, WooCommerce ve Pazarama entegrasyon altyapılarımız ise planlanan aşamadadır.',
      aEn: 'Alqora features dynamic APIs with Trendyol, Hepsiburada, Amazon, N11, and CicekSepeti. Connectors for Shopify, WooCommerce, and Pazarama are currently in our development roadmap.'
    },
    {
      qTr: 'Çoklu depo ve lokasyon takibi bu sektöre özel çalışır mı?',
      qEn: 'Does multi-warehouse tracking adapt to this specific sector?',
      aTr: 'Evet, depolama ve WMS altyapımız sektörünüze özel lokasyon atama (örn. tekstil için askı grupları, gıda için soğuk odalar) özelliklerini destekler. Siparişlerinizi depolarınıza akıllı kurallara göre dağıtabilirsiniz.',
      aEn: 'Yes, our WMS layout adapts to industry storage configurations (e.g. hangers for clothing, cool zones for groceries). Smart routing rules auto-distribute pick requests to matching bays.'
    },
    {
      qTr: 'Stoklar satış kanalları arasında ne kadar sürede senkronize olur?',
      qEn: 'How fast is inventory synchronized across channels?',
      aTr: 'Alqora envanter senkronizasyon motoru stok hareketlerini gerçek zamanlı olarak takip eder. Bir kanalda satış yapıldığı veya depo girişi girildiği anda stoklar tüm entegrasyonlarda milisaniyeler içinde eşitlenir.',
      aEn: 'The Alqora sync engine tracks stock counts in real time. Quantities update across all connected shop storefronts within milliseconds as soon as a pick finishes.'
    },
    {
      qTr: 'Depo personelinin el terminali barkod tarama süreçleri destekleniyor mu?',
      qEn: 'Are scanner barcode pick loops supported?',
      aTr: 'Evet, depo içi toplama, rafa koyma ve istasyon paket doğrulama süreçleri barkodlu el terminalleri ve mobil cihazlar ile %100 entegre yönetilerek yanlış ürün çıkış oranı sıfırlanır.',
      aEn: 'Yes, inbound stow, warehouse picks, and pack station checks are fully governed by barcode scanner workflows, reducing errors to zero.'
    }
  ];

  // Contact Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    orderVolume: '',
    channels: '',
    agreeKvkk: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Accordion State
  const [openAccordionIdx, setOpenAccordionIdx] = useState<number | null>(0);

  // Set page metadata dynamically
  useEffect(() => {
    document.title = isTr ? sectorData.titleTr : sectorData.titleEn;
    
    // Set meta description
    const descEl = document.querySelector('meta[name="description"]');
    const descText = isTr ? sectorData.descTr : sectorData.descEn;
    if (descEl) {
      descEl.setAttribute('content', descText);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = descText;
      document.head.appendChild(meta);
    }
  }, [isTr, sectorData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = isTr ? 'Ad soyad alanı zorunludur' : 'Name and surname is required';
    if (!formData.email.trim()) {
      newErrors.email = isTr ? 'E-posta alanı zorunludur' : 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = isTr ? 'Geçersiz e-posta formatı' : 'Invalid e-posta format';
    }
    if (!formData.phone.trim()) newErrors.phone = isTr ? 'Telefon alanı zorunludur' : 'Phone number is required';
    if (!formData.orderVolume) newErrors.orderVolume = isTr ? 'Aylık sipariş hacmi seçilmelidir' : 'Please select monthly order volume';
    if (!formData.agreeKvkk) newErrors.agreeKvkk = isTr ? 'KVKK metnini onaylamanız gerekmektedir' : 'You must accept the KVKK consent checkbox';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    // Simulate API request
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        orderVolume: '',
        channels: '',
        agreeKvkk: false
      });
    }, 1500);
  };

  const activeMetrics = isTr ? sectorData.metricsTr : sectorData.metricsEn;

  return (
    <div className="relative min-h-screen w-full bg-kp-bg-primary text-kp-text-primary font-outfit overflow-hidden transition-colors duration-300">
      {/* Abstract Background Glows */}
      <div className="absolute top-1/6 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-kp-accent/5 dark:bg-kp-accent/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-violet-600/5 dark:bg-violet-600/10 blur-[160px] pointer-events-none" />

      {/* Main navigation */}
      <Navbar />

      {/* 5. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-kp-accent-muted text-kp-accent border border-kp-accent/20 tracking-wider uppercase">
              {isTr ? sectorData.tagTr : sectorData.tagEn}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-kp-text-primary leading-tight">
              {isTr ? sectorData.h1Tr : sectorData.h1En}
            </h1>
            <p className="text-base sm:text-lg text-kp-text-secondary leading-relaxed max-w-2xl">
              {isTr ? sectorData.descTr : sectorData.descEn}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={isAuthenticated ? '/select-tenant' : '/auth/login'}
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white shadow-kp-card hover:shadow-kp-glow transition-all duration-200"
              >
                {isTr ? 'Ücretsiz Başlayın' : 'Start Free Trial'}
              </Link>
              <a
                href="#contact"
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-bg-secondary border border-kp-border text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
              >
                {isTr ? 'Demo Talep Edin' : 'Request Demo'}
              </a>
            </div>
          </div>

          {/* Dynamic Interactive SVG Hero Dashboard Mockup depending on sector! */}
          <div className="lg:col-span-6 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-5 shadow-kp-dropdown relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-kp-accent/5 rounded-bl-full pointer-events-none" />
            
            {/* Header controls mockup */}
            <div className="flex items-center justify-between border-b border-kp-border-subtle pb-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-xs text-kp-text-tertiary ml-2 font-mono font-medium">alqora-dashboard.wms</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">LIVE</span>
            </div>

            {/* Metrics cards grid driven by sector data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {activeMetrics.map((m, idx) => (
                <div key={idx} className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 space-y-1">
                  <p className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-wider">{m.label}</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-base sm:text-lg font-bold text-kp-text-primary">{m.val}</p>
                    <span className={`text-[10px] font-bold ${
                      m.trend.startsWith('+') ? 'text-green-500' : 'text-kp-accent'
                    }`}>{m.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Specific Mockup Visualization based on sector */}
            {slug === 'fashion-and-apparel' ? (
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4 text-xs font-mono">
                <div className="flex justify-between border-b border-kp-border pb-1.5 font-bold mb-2">
                  <span>Variant (Color/Size)</span>
                  <span>Rack Location</span>
                  <span>Stock</span>
                </div>
                <div className="space-y-1 text-[11px] text-kp-text-secondary">
                  <div className="flex justify-between">
                    <span>🔴 RED / M (T-shirt)</span>
                    <span>Zone A-42-H</span>
                    <span className="font-bold text-kp-text-primary">120</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🔵 BLUE / L (T-shirt)</span>
                    <span>Zone A-42-I</span>
                    <span className="font-bold text-kp-text-primary">85</span>
                  </div>
                  <div className="flex justify-between text-kp-accent">
                    <span>⚫ BLACK / S (T-shirt)</span>
                    <span>Zone A-43-A</span>
                    <span className="font-bold">210</span>
                  </div>
                </div>
              </div>
            ) : slug === 'cosmetics-and-personal-care' ? (
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4 text-xs font-mono">
                <div className="flex justify-between border-b border-kp-border pb-1.5 font-bold mb-2">
                  <span>Batch (Lot No)</span>
                  <span>Expiry Date</span>
                  <span>Compliance</span>
                </div>
                <div className="space-y-1 text-[11px] text-kp-text-secondary">
                  <div className="flex justify-between">
                    <span>LOT-2026-X9</span>
                    <span>12/2028</span>
                    <span className="text-green-500">ÜTS OK</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LOT-2026-X8</span>
                    <span>08/2027</span>
                    <span className="text-green-500">ÜTS OK</span>
                  </div>
                  <div className="flex justify-between text-yellow-500">
                    <span>LOT-2025-A1</span>
                    <span>11/2026</span>
                    <span>{isTr ? 'SKT Yakın' : 'Near Expiry'}</span>
                  </div>
                </div>
              </div>
            ) : slug === 'electronics' ? (
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4 text-xs font-mono">
                <div className="flex justify-between border-b border-kp-border pb-1.5 font-bold mb-2">
                  <span>Serial (IMEI / SN)</span>
                  <span>Invoice Match</span>
                  <span>Warranty</span>
                </div>
                <div className="space-y-1 text-[11px] text-kp-text-secondary">
                  <div className="flex justify-between">
                    <span>SN-98402940294</span>
                    <span>INV-2026-902</span>
                    <span className="text-kp-accent">24 Months</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SN-84920294921</span>
                    <span>INV-2026-903</span>
                    <span className="text-kp-accent">24 Months</span>
                  </div>
                  <div className="flex justify-between text-green-500">
                    <span>SN-10920492049</span>
                    <span>INV-2026-904</span>
                    <span>{isTr ? 'Aktif' : 'Active'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-kp-text-primary">{isTr ? 'Haftalık Sipariş Analizi' : 'Weekly Order Trends'}</h4>
                  <span className="text-[10px] font-semibold text-kp-text-tertiary">10-17 July</span>
                </div>
                <svg className="w-full h-32 text-kp-accent" viewBox="0 0 300 100" fill="none">
                  <defs>
                    <linearGradient id="chart-grad-sec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,80 Q25,60 50,70 T100,40 T150,55 T200,30 T250,45 T300,15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M0,80 Q25,60 50,70 T100,40 T150,55 T200,30 T250,45 T300,15 L300,100 L0,100 Z" fill="url(#chart-grad-sec)" />
                </svg>
              </div>
            )}

            {/* Channels block */}
            <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs border-b border-kp-border-subtle pb-2">
                <span className="font-bold text-kp-text-primary">{isTr ? 'Bağlı Pazaryerleri' : 'Connected Channels'}</span>
                <span className="text-kp-text-tertiary font-medium">5 {isTr ? 'Aktif' : 'Active'}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {['Trendyol', 'Hepsiburada', 'Amazon', 'N11', 'ÇiçekSepeti'].map((channel) => (
                  <span key={channel} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-kp-bg-secondary border border-kp-border-subtle text-[10px] font-bold text-kp-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {channel}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. TRUST & BENEFIT SHIELD */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconShop /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{isTr ? 'Tek Panelde Yönetim' : 'Unified Sales Channels'}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{isTr ? 'Tüm e-ticaret mağazaları ve pazaryerleri tek bir panelde birleşir.' : 'All e-commerce sites and marketplace accounts in one dashboard.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconSync /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{isTr ? 'Anlık Stok Senkronu' : 'Real-time Stock Sync'}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{isTr ? 'Bir kanaldan satılan ürün tüm kanallardan otomatik düşer.' : 'Stock is updated globally instantly as soon as a purchase happens.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconBarcode /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{isTr ? 'Depo & Barkod Desteği' : 'Warehouse & Barcode'}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{isTr ? 'Çoklu depo altyapısı ve barkodlu el terminali toplama süreçleri.' : 'Support for multiple warehouse allocations and scanner terminals.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconTruck /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{isTr ? 'Akıllı Otomasyonlar' : 'Automated Shipping'}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{isTr ? 'Desi, kargo entegrasyonu ve paketleme talimatları otomatikleşir.' : 'Autopilot rules for carrier matching, packaging types, and shipping.'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PROBLEM & SOLUTIONS SECTIONS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-24">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
            {isTr ? 'Operasyonel Karmaşıklığı Ortadan Kaldırın' : 'Eliminate Operational Complexity'}
          </h2>
          <p className="text-base text-kp-text-secondary leading-relaxed">
            {isTr 
              ? 'Çok kanallı satış, karmaşık envanter hareketleri, raf adresleme ve kurye atama süreçlerini merkezi iş akışlarıyla sadeleştirin.'
              : 'Simplify your multi-channel sales, inventory counts, bin indexing, and carrier paths with unified automation rules.'}
          </p>
        </div>

        {/* Loop through solutions dynamic listings */}
        {sectorData.solutions.map((sol, idx) => {
          const title = isTr ? sol.titleTr : sol.titleEn;
          const desc = isTr ? sol.descTr : sol.descEn;
          const tag = isTr ? sol.tagTr : sol.tagEn;
          const features = isTr ? sol.featuresTr : sol.featuresEn;

          return (
            <div key={idx} className={`grid grid-cols-1 lg:grid-cols-12 gap-12 items-center ${idx % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
              <div className={`lg:col-span-6 space-y-5 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">{sol.num} / {tag}</span>
                <h3 className="text-2xl font-bold text-kp-text-primary">{title}</h3>
                <p className="text-sm text-kp-text-secondary leading-relaxed">{desc}</p>
                <ul className="grid grid-cols-2 gap-3 pt-2">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-kp-text-secondary">
                      <CheckCircleIcon className="h-4 w-4 text-kp-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Solution Specific Mockup Representation */}
              <div className={`lg:col-span-6 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                <h4 className="text-xs font-bold text-kp-text-primary mb-3">{isTr ? 'Süreç Doğrulama Arayüzü' : 'Process Validation Console'}</h4>
                <div className="space-y-3 font-mono text-[10px] text-kp-text-secondary">
                  <div className="bg-kp-bg-primary border border-kp-border-subtle p-3 rounded space-y-1">
                    <span className="text-kp-accent font-bold">IF:</span>
                    <p>Trigger Category Match = "{slug === 'fashion-and-apparel' ? 'Apparel' : slug === 'electronics' ? 'Electronics' : 'FMCG'}"</p>
                  </div>
                  <div className="text-center py-1">⬇️</div>
                  <div className="bg-kp-bg-primary border border-kp-border-subtle p-3 rounded space-y-1">
                    <span className="text-green-500 font-bold">THEN ACTION:</span>
                    <p>Assign Action = "Auto-verify and process shipment"</p>
                    <p>Apply Status = "Synched & Dispatched"</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 8. INTEGRATIONS LIST */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
              {isTr ? 'Müşterileriniz Nerede Satın Alıyorsa Orada Olun' : 'Sell Everywhere Your Customers Are Buying'}
            </h2>
            <p className="text-base text-kp-text-secondary">
              {isTr 
                ? 'Mağazanızı ve pazaryeri hesaplarınızı Alqora’ya bağlayarak ürün, sipariş, stok ve fiyat operasyonlarını tek panelde yönetin.'
                : 'Connect your store and marketplace accounts to Alqora to govern products, orders, stock levels, and pricing from a single workspace.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Trendyol', status: isTr ? 'Aktif' : 'Active', features: ['Stok Senkronizasyonu', 'Sipariş İçe Aktarma', 'Fiyat Yönetimi'] },
              { name: 'Hepsiburada', status: isTr ? 'Aktif' : 'Active', features: ['Sipariş Çekme', 'Stok Eşleme', 'Sevkiyat Onayı'] },
              { name: 'Amazon', status: isTr ? 'Aktif' : 'Active', features: ['Çok Kanallı Envanter', 'Sipariş Akışı', 'Fiyat Senkronu'] },
              { name: 'Shopify', status: isTr ? 'Planlanan' : 'Soon', features: ['Mağaza Entegrasyonu', 'Katalog Aktarımı', 'Müşteri Kartları'] }
            ].map((p, idx) => (
              <div key={idx} className="bg-kp-bg-primary border border-kp-border rounded-kp-lg p-6 text-left space-y-4 shadow-kp-card hover:border-kp-accent/40 transition-colors">
                <div className="flex items-center justify-between border-b border-kp-border-subtle pb-3">
                  <h4 className="text-sm font-bold text-kp-text-primary">{p.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.status.startsWith('Ak') || p.status === 'Active'
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-kp-text-tertiary/10 text-kp-text-tertiary border border-kp-text-tertiary/20'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-kp-text-secondary">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-kp-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/${locale}`} className="text-xs font-bold text-kp-accent hover:text-kp-accent-hover inline-flex items-center gap-1 transition-colors">
                  {isTr ? 'Entegrasyonu İncele' : 'Review Integration'}
                  <span>→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. OPERATIONAL CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
            {isTr ? 'Güçlü ve Gelişmiş Operasyon Yetenekleri' : 'Advanced Operations Infrastructure'}
          </h2>
          <p className="text-base text-kp-text-secondary">
            {isTr
              ? 'Tekrarlayan işleri otomatize edin, tedarikçilerinizle entegre çalışın ve tüm iade/fiyat operasyonlarını tek merkezden yönetin.'
              : 'Automate manual processes, integrate with suppliers, and run pricing or return workflows under a unified hub.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{isTr ? 'Otomatik Fiyat ve Kampanya Yönetimi' : 'Automated Price & Campaign Control'}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {isTr
                ? 'Kanal bazlı komisyon, maliyet, kâr marjı ve kampanya koşullarına göre satış fiyatlarını merkezi olarak yönetin. Farklı pazaryerlerine özel fiyat kuralları atayın.'
                : 'Unify price controls factoring in marketplace commission ratios, operational costs, profit margins, and seasonal sales. Distribute target pricing configurations globally.'}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{isTr ? 'Merkezi İade Yönetimi' : 'Centralized Return Management'}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {isTr
                ? 'Farklı kanallardan gelen iadeleri tek panelde takip edin; ürün kalite kontrolü, stok girişi, ücret iadesi ve muhasebe adımlarını kayıt altına alın.'
                : 'Track incoming customer returns from various marketplaces in one panel. Monitor quality control logs, return stock injections, and automated customer refunds.'}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{isTr ? 'Tedarikçi ve ERP Entegrasyon Altyapısı' : 'Supplier & ERP Sync Layout'}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {isTr
                ? 'Ürün, stok, sipariş ve fatura verilerini Logo GO, Logo Tiger veya diğer popüler ön muhasebe ve ERP sistemleriyle eşitleyecek entegrasyon altyapısını kullanın.'
                : 'Leverage data synchronizers to feed order details, invoices, and product SKUs into popular ERP systems (such as Logo GO or Logo Tiger) and accounting ledgers.'}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-4">
            <h3 className="text-lg font-bold text-kp-text-primary">{isTr ? 'Kural Tabanlı İş Akışı Otomasyonu' : 'Rule-Based Workflow Automation'}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {isTr
                ? 'Sipariş durumu, ürün tipi, depo, stok seviyesi veya teslimat bölgesine göre otomatik aksiyonlar tanımlayın. Personel hatalarını tamamen ortadan kaldırın.'
                : 'Define logic macros triggering events based on order values, channel parameters, stock levels, or weight categories to eliminate human errors.'}
            </p>
            <div className="space-y-1.5 font-mono text-[10px] text-kp-text-tertiary">
              <p>✔ {isTr ? 'Sipariş geldiğinde stok ayır' : 'Block stock when order drops'}</p>
              <p>✔ {isTr ? 'İstasyon barkodunu anlık eşitle' : 'Sync pack codes instantly'}</p>
              <p>✔ {isTr ? 'Hassas ürün siparişlerine uyarı notu ekle' : 'Add visual alert labels dynamically'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. HOW IT WORKS */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
              {isTr ? 'Alqora ile Operasyon Nasıl Çalışır?' : 'How Operations Work with Alqora'}
            </h2>
            <p className="text-base text-kp-text-secondary">
              {isTr 
                ? '4 basit adımda sistem kurulumunuzu tamamlayın ve operasyonlarınızı otomatize edin.' 
                : 'Get configured in 4 straightforward phases to streamline your logistics and order sync.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              { step: '01', title: isTr ? 'Kanalları Bağlayın' : 'Connect Channels', desc: isTr ? 'Pazaryeri API anahtarlarınızı girerek satış mağazalarınızı dakikalar içinde entegre edin.' : 'Paste API keys to connect your retail marketplace storefronts in minutes.' },
              { step: '02', title: isTr ? 'Verileri Merkezileştirin' : 'Centralize Catalog', desc: isTr ? 'Tüm ürün, fiyat ve stok kataloğunuzu merkezi tek bir envantere aktarın.' : 'Consolidate all SKU listings, pricing tiers, and inventories in one place.' },
              { step: '03', title: isTr ? 'Kurallarınızı Belirleyin' : 'Establish Rules', desc: isTr ? 'Depo dağıtım, kırılabilir paketleme ve kargo kurallarınızı tanımlayın.' : 'Define depot routing rules, fragile warnings, and volumetric desi bounds.' },
              { step: '04', title: isTr ? 'Tek Panelden Takip Edin' : 'Track Operations', desc: isTr ? 'Sipariş toplama, paketleme, faturalama ve sevkiyatları anlık panelle yönetin.' : 'Monitor picks, packing lines, invoices, and shipping dates from a single screen.' }
            ].map((s, idx) => (
              <div key={idx} className="space-y-3 text-center md:text-left relative z-10 bg-kp-bg-primary border border-kp-border p-5 rounded-kp-lg shadow-kp-card">
                <span className="text-3xl font-extrabold text-kp-accent/20 block">{s.step}</span>
                <h4 className="text-base font-bold text-kp-text-primary">{s.title}</h4>
                <p className="text-xs text-kp-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. DASHBOARD OVERVIEW AREA (Dark Block) */}
      <section className="bg-slate-950 text-slate-100 py-20 relative border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12 relative z-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {isTr ? 'Siparişten Teslimata Kadar Tam Görünürlük' : 'Full Operational Visibility from Click to Carrier'}
            </h2>
            <p className="text-base text-slate-400">
              {isTr 
                ? 'Satış, stok, depo ve sevkiyat performansınızı gerçek zamanlı paneller üzerinden takip edin. Darboğazları erkenden görün ve kararlarınızı veriye dayalı alın.'
                : 'Track daily sales margins, picker tasks, stock turns, and delivery metrics in real time. Eliminate operational blockages proactively.'}
            </p>
          </div>

          {/* Premium Real-World Mockup Admin Dashboard */}
          <div className="bg-slate-900 border border-white/10 rounded-kp-lg p-6 max-w-4xl mx-auto shadow-2xl text-left space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ALQORA WMS // LIVE STATISTICS</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">SYSTEM HEALTHY</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isTr ? 'Bugünkü Siparişler' : 'Today\'s Orders'}</p>
                <p className="text-xl font-bold text-white mt-1">2,840</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isTr ? 'Hazırlanmayı Bekleyen' : 'Pending Picking'}</p>
                <p className="text-xl font-bold text-yellow-500 mt-1">114</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isTr ? 'Kritik Stoktaki SKU' : 'Critical Stock SKU'}</p>
                <p className="text-xl font-bold text-red-500 mt-1">12</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isTr ? 'Geciken Sevkiyat' : 'Delayed Shipments'}</p>
                <p className="text-xl font-bold text-white mt-1">0</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 border border-white/5 rounded space-y-2 col-span-2">
                <div className="flex justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
                  <span className="font-bold">{isTr ? 'Depo Verimliliği' : 'Depot Efficiencies'}</span>
                  <span>July 2026</span>
                </div>
                <div className="space-y-3 pt-1 text-[11px]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{isTr ? 'Toplama Başarı Oranı' : 'Picking Accuracy'}</span>
                      <span className="font-bold text-green-500">99.9%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[99.9%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{isTr ? 'Kutulama Hızı' : 'Packing Speeds'}</span>
                      <span className="font-bold text-kp-accent">94.8%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-kp-accent h-full w-[94.8%]" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-950 p-4 border border-white/5 rounded space-y-3 text-xs">
                <div className="text-slate-400 font-bold border-b border-white/5 pb-2">{isTr ? 'İade Oranı & Süresi' : 'Returns & Times'}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{isTr ? 'Ortalama Hazırlama Süresi:' : 'Avg. Picking Time:'}</span>
                    <span className="font-bold text-white">4.2 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{isTr ? 'Genel İade Oranı:' : 'Overall Return Rate:'}</span>
                    <span className="font-bold text-white">1.8%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 12. CONTACT / DEMO FORM AREA */}
      <section id="contact" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-8 shadow-kp-dropdown space-y-8 relative">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">
              {isTr ? 'Operasyonlarınızı Alqora ile Ölçekleyin' : 'Scale Your Operations with Alqora'}
            </h2>
            <p className="text-sm text-kp-text-secondary">
              {isTr 
                ? 'Sipariş, stok, depo ve satış kanallarınızı tek bir operasyon merkezinde birleştirin. Ekibiniz manuel işlemler yerine büyümeye odaklansın.'
                : 'Consolidate stock levels, orders, and sales integrations in one hub. Let your staff focus on scaling instead of copy-pasting.'}
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-6 rounded-kp-md text-center space-y-3 animate-scale-in">
              <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto" />
              <h4 className="text-lg font-bold">{isTr ? 'Talebiniz Alındı!' : 'Request Received!'}</h4>
              <p className="text-sm text-kp-text-secondary max-w-md mx-auto">
                {isTr 
                  ? 'Göstermiş olduğunuz ilgi için teşekkür ederiz. Sektör uzmanımız en kısa sürede sizinle iletişime geçecektir.' 
                  : 'Thank you for your interest. An integration specialist will reach out to you shortly.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                    {isTr ? 'Ad Soyad' : 'Name Surname'}
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 rounded bg-kp-bg-primary border text-sm text-kp-text-primary focus:outline-none focus:ring-1 focus:ring-kp-accent ${
                      errors.name ? 'border-red-500' : 'border-kp-border'
                    }`}
                    placeholder="Faruk Patacı"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1.5 font-semibold">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                    {isTr ? 'İş E-postası' : 'Work Email'}
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 rounded bg-kp-bg-primary border text-sm text-kp-text-primary focus:outline-none focus:ring-1 focus:ring-kp-accent ${
                      errors.email ? 'border-red-500' : 'border-kp-border'
                    }`}
                    placeholder="ad.soyad@firmasi.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1.5 font-semibold">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="phone" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                    {isTr ? 'Telefon Numarası' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 rounded bg-kp-bg-primary border text-sm text-kp-text-primary focus:outline-none focus:ring-1 focus:ring-kp-accent ${
                      errors.phone ? 'border-red-500' : 'border-kp-border'
                    }`}
                    placeholder="+90 555 123 45 67"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1.5 font-semibold">{errors.phone}</p>}
                </div>
                <div>
                  <label htmlFor="orderVolume" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                    {isTr ? 'Aylık Sipariş Hacmi' : 'Monthly Order Volume'}
                  </label>
                  <select
                    name="orderVolume"
                    id="orderVolume"
                    value={formData.orderVolume}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 rounded bg-kp-bg-primary border text-sm text-kp-text-primary focus:outline-none focus:ring-1 focus:ring-kp-accent ${
                      errors.orderVolume ? 'border-red-500' : 'border-kp-border'
                    }`}
                  >
                    <option value="">{isTr ? 'Seçiniz...' : 'Select range...'}</option>
                    <option value="0-500">0 - 500</option>
                    <option value="500-2000">500 - 2,000</option>
                    <option value="2000-5000">2,000 - 5,000</option>
                    <option value="5000+">5,000+</option>
                  </select>
                  {errors.orderVolume && <p className="text-red-500 text-xs mt-1.5 font-semibold">{errors.orderVolume}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="channels" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                  {isTr ? 'Kullanılan Satış Kanalları' : 'Active Sales Channels'}
                </label>
                <input
                  type="text"
                  name="channels"
                  id="channels"
                  value={formData.channels}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 rounded bg-kp-bg-primary border border-kp-border text-sm text-kp-text-primary focus:outline-none focus:ring-1 focus:ring-kp-accent"
                  placeholder="Trendyol, Hepsiburada, Shopify vb."
                />
              </div>

              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="agreeKvkk"
                    id="agreeKvkk"
                    checked={formData.agreeKvkk}
                    onChange={handleInputChange}
                    className="h-4.5 w-4.5 rounded border-kp-border text-kp-accent focus:ring-kp-accent mt-0.5"
                  />
                  <label htmlFor="agreeKvkk" className="text-xs text-kp-text-secondary leading-relaxed">
                    {isTr 
                      ? 'Kişisel verilerimin işlenmesine ilişkin KVKK Bilgilendirme metnini okudum ve Alqora tarafından pazarlama faaliyetleri amacıyla benimle iletişime geçilmesini onaylıyorum.'
                      : 'I have read the KVKK Privacy Agreement and consent to Alqora contacting me regarding operational services and marketing notifications.'}
                  </label>
                </div>
                {errors.agreeKvkk && <p className="text-red-500 text-xs mt-1.5 font-semibold">{errors.agreeKvkk}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 text-sm font-bold rounded bg-kp-accent hover:bg-kp-accent-hover text-white transition-all shadow shadow-kp-glow inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {isTr ? 'Talep Gönderiliyor...' : 'Sending Request...'}
                  </>
                ) : (
                  isTr ? 'Demoyu Başlatın' : 'Request Demo Activation'
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 13. SSS ACCORDIONS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-kp-border">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <h2 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">
            {isTr ? 'Sıkça Sorulan Sorular' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-sm text-kp-text-secondary">
            {isTr 
              ? 'Sektörel e-ticaret operasyonlarımızla ilgili merak ettiğiniz tüm soruların cevapları.'
              : 'Answers to help you optimize and set up your specific industry storefront configurations.'}
          </p>
        </div>

        <div className="space-y-1">
          {sssItems.map((item, idx) => {
            const q = isTr ? item.qTr : item.qEn;
            const a = isTr ? item.aTr : item.aEn;
            return (
              <AccordionItem
                key={idx}
                question={q}
                answer={a}
                isOpen={openAccordionIdx === idx}
                onClick={() => setOpenAccordionIdx(openAccordionIdx === idx ? null : idx)}
              />
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
