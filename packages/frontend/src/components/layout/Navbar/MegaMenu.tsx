'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  ShoppingBagIcon,
  FolderOpenIcon,
  CircleStackIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  TruckIcon,
  ArrowPathIcon,
  TagIcon,
  CpuChipIcon,
  SparklesIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowRightIcon,
  CommandLineIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
  BriefcaseIcon,
  WrenchScrewdriverIcon,
  PresentationChartLineIcon,
  LifebuoyIcon
} from '@heroicons/react/24/outline';

// ----------------------------------------------------
// PLATFORM FEATURES MENU
// ----------------------------------------------------
export function PlatformFeaturesMenu() {
  const locale = useLocale();
  const isTr = locale === 'tr';

  const data = {
    col1: {
      title: isTr ? 'Operasyon Yönetimi' : 'Operations Management',
      items: [
        {
          name: isTr ? 'Sipariş Yönetimi' : 'Order Management',
          desc: isTr ? 'Tüm pazaryeri ve mağaza siparişlerini tek ekrandan yönetin.' : 'Manage all marketplace and store orders from a single screen.',
          icon: ShoppingBagIcon,
          href: '#orders'
        },
        {
          name: isTr ? 'Ürün & Katalog Yönetimi' : 'Product & Catalog Management',
          desc: isTr ? 'Ürün verilerini, varyantları ve içerikleri merkezi olarak yönetin.' : 'Manage product data, variants, and contents centrally.',
          icon: FolderOpenIcon,
          href: '#catalog'
        },
        {
          name: isTr ? 'Stok Yönetimi' : 'Inventory Management',
          desc: isTr ? 'Depo stoklarını kanallar arasında gerçek zamanlı senkronize edin.' : 'Synchronize warehouse stocks across channels in real-time.',
          icon: CircleStackIcon,
          href: '#stock'
        },
        {
          name: isTr ? 'Fiyat Otomasyonu' : 'Price Automation',
          desc: isTr ? 'Fiyat, marj ve rekabet kurallarını otomatik uygulayın.' : 'Apply pricing, margin, and competition rules automatically.',
          icon: BanknotesIcon,
          href: '#pricing-rules'
        }
      ]
    },
    col2: {
      title: isTr ? 'Lojistik & Depo' : 'Logistics & Warehouse',
      items: [
        {
          name: isTr ? 'WMS / Depo Yönetimi' : 'WMS / Warehouse Management',
          desc: isTr ? 'Toplama, paketleme, raf ve depo operasyonlarını yönetin.' : 'Manage picking, packing, shelving, and warehouse operations.',
          icon: BuildingOfficeIcon,
          href: '#wms'
        },
        {
          name: isTr ? 'Kargo Yönetimi' : 'Shipping Management',
          desc: isTr ? 'Kargo oluşturma, etiket basma ve takip süreçlerini tek noktada yürütün.' : 'Run shipping creation, label printing, and tracking at a single point.',
          icon: TruckIcon,
          href: '#shipping'
        },
        {
          name: isTr ? 'İade Yönetimi' : 'Return Management',
          desc: isTr ? 'İade taleplerini, kalite kontrolü ve stok dönüşlerini takip edin.' : 'Track return requests, quality control, and inventory returns.',
          icon: ArrowPathIcon,
          href: '#returns'
        },
        {
          name: isTr ? 'Etiket & Yazıcı Merkezi' : 'Label & Printer Hub',
          desc: isTr ? 'Kargo etiketleri ve bağlı yazıcı yapılandırmalarını yönetin.' : 'Manage shipping labels and connected printer configurations.',
          icon: TagIcon,
          href: '#labels'
        }
      ]
    },
    col3: {
      title: isTr ? 'Otomasyon & Zekâ' : 'Automation & Intelligence',
      items: [
        {
          name: isTr ? 'İş Akışı Otomasyonu' : 'Workflow Automation',
          desc: isTr ? 'Tetikleyici ve koşullara bağlı tekrarlayan süreçleri otomatikleştirin.' : 'Automate repetitive processes based on triggers and conditions.',
          icon: CpuChipIcon,
          href: '#automation'
        },
        {
          name: isTr ? 'Yapay Zekâ Asistanı' : 'AI Assistant',
          desc: isTr ? 'Ürün içerikleri, açıklamalar ve operasyon önerilerini AI ile oluşturun.' : 'Create product descriptions, contents, and operational suggestions with AI.',
          icon: SparklesIcon,
          href: '#ai'
        },
        {
          name: isTr ? 'Analitik & Raporlama' : 'Analytics & Reporting',
          desc: isTr ? 'Sipariş, satış, kârlılık ve operasyon KPI’larını inceleyin.' : 'Inspect orders, sales, profitability, and operational KPIs.',
          icon: ChartBarIcon,
          href: '#analytics'
        },
        {
          name: isTr ? 'B2B & Tedarikçi Ağı' : 'B2B & Supplier Network',
          desc: isTr ? 'Tedarikçi, bayi ve iş ortaklarıyla veri akışını yönetin.' : 'Manage data flow with suppliers, dealers, and business partners.',
          icon: UserGroupIcon,
          href: '#b2b'
        }
      ]
    },
    banner: {
      title: isTr ? 'Tüm operasyonlarınız tek platformda' : 'All your operations in one platform',
      desc: isTr
        ? 'Siparişten depoya, kargodan muhasebeye kadar tüm süreçleri Alqora ile yönetin.'
        : 'Manage all processes from order to warehouse, shipping to accounting with Alqora.',
      cta: isTr ? 'Tüm Özellikleri İncele' : 'Explore All Features'
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 3 Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-kp-bg-secondary border-b border-kp-border">
        {[data.col1, data.col2, data.col3].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={i}>
                    <Link
                      href={item.href}
                      className="group flex gap-4 p-2.5 rounded-kp-md hover:bg-kp-bg-hover transition-all duration-200"
                    >
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-kp-sm bg-kp-bg-tertiary border border-kp-border-subtle group-hover:border-kp-border-accent group-hover:bg-kp-accent-muted text-kp-text-tertiary group-hover:text-kp-accent transition-all">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-kp-text-tertiary leading-normal line-clamp-1">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Spotlight Bottom Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-kp-bg-tertiary/40 hover:bg-kp-bg-tertiary/70 transition-colors">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-kp-success animate-pulse-dot" />
            {data.banner.title}
          </h4>
          <p className="text-xs text-kp-text-tertiary">
            {data.banner.desc}
          </p>
        </div>
        <Link
          href="#features"
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-kp-accent hover:text-kp-accent-hover transition-colors"
        >
          <span>{data.banner.cta}</span>
          <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SOLUTIONS MENU
// ----------------------------------------------------
export function SolutionsMenu() {
  const locale = useLocale();
  const isTr = locale === 'tr';

  const data = {
    col1: {
      title: isTr ? 'Firma Ölçeğine Göre' : 'By Company Size',
      items: [
        isTr ? 'Yeni Başlayan Markalar' : 'Startup Brands',
        isTr ? 'Büyüyen E-Ticaret İşletmeleri' : 'Growing E-Commerce Businesses',
        isTr ? 'Çok Kanallı Satış Yapan Markalar' : 'Omnichannel Retail Brands',
        isTr ? 'Kurumsal / Enterprise Şirketler' : 'Enterprise Corporations'
      ]
    },
    col2: {
      title: isTr ? 'İş Modeline Göre' : 'By Business Model',
      items: [
        isTr ? 'Pazaryeri Satıcıları' : 'Marketplace Sellers',
        isTr ? 'Kendi E-Ticaret Sitesi Olan Markalar' : 'Brands with Own E-Commerce Sites',
        isTr ? 'B2B Toptan Satış' : 'B2B Wholesale Sales',
        isTr ? 'Dropshipping ve Tedarikçi Yönetimi' : 'Dropshipping & Supplier Management',
        isTr ? '3PL / Fulfillment Operasyonları' : '3PL / Fulfillment Operations'
      ]
    },
    col3: {
      title: isTr ? 'Sektöre Göre' : 'By Industry',
      items: [
        isTr ? 'Moda & Tekstil' : 'Fashion & Apparel',
        isTr ? 'Kozmetik & Kişisel Bakım' : 'Cosmetics & Personal Care',
        isTr ? 'Elektronik' : 'Electronics',
        isTr ? 'Ev & Yaşam' : 'Home & Living',
        isTr ? 'Otomotiv Yedek Parça' : 'Automotive Spare Parts',
        isTr ? 'Gıda & Hızlı Tüketim' : 'Food & FMCG'
      ]
    },
    promo: {
      tag: 'Alqora Enterprise',
      title: isTr ? 'Karmaşık operasyonları sadeleştirin' : 'Simplify complex operations',
      desc: isTr
        ? 'Yüksek sipariş hacmi ve çoklu depo operasyonları için ölçeklenebilir altyapı.'
        : 'Scalable infrastructure for high order volume and multi-warehouse operations.',
      cta: isTr ? 'Uzmanla Görüş' : 'Talk to an Expert'
    }
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-4 bg-kp-bg-secondary">
      {/* 3 Links Columns */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-8 p-8 border-r border-kp-border">
        {[data.col1, data.col2, data.col3].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
              {col.title}
            </h3>
            <ul className="space-y-3">
              {col.items.map((item, i) => {
                let href = `#solutions-${idx}-${i}`;
                if (idx === 2) {
                  const slugs = [
                    'fashion-and-apparel',
                    'cosmetics-and-personal-care',
                    'electronics',
                    'home-and-garden',
                    'automotive-spare-parts',
                    'food-and-fmcg'
                  ];
                  href = `/${locale}/industry/${slugs[i]}`;
                }
                return (
                  <li key={i}>
                    <Link
                      href={href}
                      className="text-sm text-kp-text-secondary hover:text-kp-accent hover:underline transition-all block py-0.5"
                    >
                      {item}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Dynamic Theme Promo Card */}
      <div className="p-8 bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-[#0b0e22] dark:to-neutral-950 flex flex-col justify-between space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-kp-accent-muted text-kp-accent border border-kp-accent/20">
            {data.promo.tag}
          </span>
          <h4 className="text-base font-bold text-kp-text-primary leading-snug">
            {data.promo.title}
          </h4>
          <p className="text-xs text-kp-text-tertiary leading-relaxed">
            {data.promo.desc}
          </p>
        </div>
        <Link
          href="#contact"
          className="group inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white transition-all shadow-kp-card hover:shadow-kp-glow"
        >
          <span>{data.promo.cta}</span>
          <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// RESOURCES MENU
// ----------------------------------------------------
export function ResourcesMenu() {
  const locale = useLocale();
  const isTr = locale === 'tr';

  const data = {
    col1: {
      title: isTr ? 'Öğren' : 'Learn',
      items: [
        {
          name: isTr ? 'Yardım Merkezi' : 'Help Center',
          desc: isTr ? 'Sistem kullanımıyla ilgili kılavuzlara ve sıkça sorulan sorulara ulaşın.' : 'Access system usage guides and frequently asked questions.',
          icon: QuestionMarkCircleIcon,
          href: '#help'
        },
        {
          name: isTr ? 'Alqora Akademi' : 'Alqora Academy',
          desc: isTr ? 'Eğitimleri tamamlayın ve uzmanlık sertifikaları alın.' : 'Complete trainings and earn expertise certifications.',
          icon: AcademicCapIcon,
          href: '#academy'
        },
        {
          name: isTr ? 'Blog' : 'Blog',
          desc: isTr ? 'E-ticaret ve depo yönetimi alanındaki son gelişmeleri takip edin.' : 'Follow the latest developments in e-commerce and warehouse management.',
          icon: ChatBubbleLeftRightIcon,
          href: '#blog'
        },
        {
          name: isTr ? 'API Dokümantasyonu' : 'API Documentation',
          desc: isTr ? 'Geliştiriciler için teknik API ve entegrasyon dokümanları.' : 'Technical API and integration docs for developers.',
          icon: CommandLineIcon,
          href: '#api-docs'
        },
        {
          name: isTr ? 'Entegrasyon Rehberleri' : 'Integration Guides',
          desc: isTr ? 'Pazaryerleri ve kargo kurulum adımlarını adım adım öğrenin.' : 'Learn marketplace and shipping setup steps step-by-step.',
          icon: DocumentTextIcon,
          href: '#guides'
        }
      ]
    },
    col2: {
      title: isTr ? 'Hizmetler' : 'Services',
      items: [
        {
          name: isTr ? 'Sistem Kurulumu' : 'System Setup',
          desc: isTr ? 'Hesap kurulumu ve başlangıç yapılandırma desteği alın.' : 'Get support for account setup and initial configuration.',
          icon: BriefcaseIcon,
          href: '#setup'
        },
        {
          name: isTr ? 'Entegrasyon Danışmanlığı' : 'Integration Consultancy',
          desc: isTr ? 'Özel ERP ve API entegrasyonları için uzman rehberliği.' : 'Expert guidance for custom ERP and API integrations.',
          icon: PresentationChartLineIcon,
          href: '#consulting'
        },
        {
          name: isTr ? 'Operasyon Analizi' : 'Operation Analysis',
          desc: isTr ? 'Depo ve lojistik süreçlerinizi optimize edecek analizler.' : 'Analyses to optimize your warehouse and logistics processes.',
          icon: WrenchScrewdriverIcon,
          href: '#analysis'
        },
        {
          name: isTr ? 'Teknik Destek' : 'Technical Support',
          desc: isTr ? 'Karşılaştığınız problemler için 7/24 teknik destek hattı.' : '24/7 technical support line for issues you encounter.',
          icon: LifebuoyIcon,
          href: '#support'
        },
        {
          name: isTr ? 'İletişim' : 'Contact Us',
          desc: isTr ? 'Satış ve ortaklık teklifleriniz için bizimle iletişime geçin.' : 'Reach out for your sales and partnership proposals.',
          icon: ChatBubbleLeftRightIcon,
          href: '#contact'
        }
      ]
    },
    footer: {
      text: isTr
        ? 'E-ticaret operasyonunuzu ne kadar iyileştirebileceğinizi hesaplayın.'
        : 'Calculate how much you can improve your e-commerce operations.',
      cta: isTr ? 'Verimlilik Analizi' : 'Efficiency Analysis'
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 2 Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-kp-bg-secondary border-b border-kp-border">
        {[data.col1, data.col2].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={i}>
                    <Link
                      href={item.href}
                      className="group flex gap-4 p-2.5 rounded-kp-md hover:bg-kp-bg-hover transition-all duration-200"
                    >
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-kp-sm bg-kp-bg-tertiary border border-kp-border-subtle group-hover:border-kp-border-accent group-hover:bg-kp-accent-muted text-kp-text-tertiary group-hover:text-kp-accent transition-all">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-kp-text-tertiary leading-normal line-clamp-1">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Vurgu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-kp-accent-muted/10 hover:bg-kp-accent-muted/20 transition-colors border-t border-kp-border">
        <p className="text-xs text-kp-text-primary font-medium">
          📊 {data.footer.text}
        </p>
        <Link
          href="#calculator"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-kp-sm bg-kp-accent-muted text-kp-accent border border-kp-accent/25 hover:bg-kp-accent hover:text-white transition-all active:scale-95"
        >
          {data.footer.cta}
        </Link>
      </div>
    </div>
  );
}
