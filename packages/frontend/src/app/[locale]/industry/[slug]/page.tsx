'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar/Navbar';
import { useAuth } from '@/lib/auth-context';
import { CheckCircleIcon } from '@heroicons/react/20/solid';

interface IndustryData {
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  featuresTr: string[];
  featuresEn: string[];
}

const INDUSTRIES: Record<string, IndustryData> = {
  'fashion-and-apparel': {
    titleTr: 'Moda & Tekstil için Depo Yönetimi',
    titleEn: 'Warehouse Management for Fashion & Apparel',
    descTr: 'Varyant (renk, beden, numara) takibi, çok kanallı sipariş yönetimi ve hızlı iade süreçleri ile tekstil operasyonlarınızı optimize edin.',
    descEn: 'Optimize your textile operations with variant (color, size, fits) tracking, omnichannel order management, and fast returns processing.',
    featuresTr: [
      'Renk, beden ve numara bazında detaylı varyant takibi',
      'Pazaryerleri ve e-ticaret siteleriyle anlık stok senkronizasyonu',
      'Barkodlu toplama ve hatasız paketleme adımları',
      'Hızlı ve kolay iade kabul süreçleri'
    ],
    featuresEn: [
      'Detailed variant tracking by color, size, and fit',
      'Instant stock synchronization with marketplaces and e-commerce platforms',
      'Barcoded picking and error-free packing steps',
      'Fast and easy returns processing'
    ]
  },
  'cosmetics-and-personal-care': {
    titleTr: 'Kozmetik & Kişisel Bakım için Depo Yönetimi',
    titleEn: 'Warehouse Management for Cosmetics & Personal Care',
    descTr: 'Son kullanma tarihi (SKT) takibi, lot/parti yönetimi ve hassas paketleme gereksinimleri için özel WMS çözümleri.',
    descEn: 'Specialized WMS solutions for expiration date tracking, lot/batch management, and fragile packaging requirements.',
    featuresTr: [
      'Lot ve parti bazında son kullanma tarihi takibi',
      'Hassas ürünler için özel paketleme ve kargo kuralları',
      'FIFO (İlk Giren İlk Çıkar) prensibine göre akıllı stok çıkışı',
      'Sıcaklık ve depolama koşulları takibi'
    ],
    featuresEn: [
      'Expiration date tracking by lot and batch',
      'Special packaging and shipping rules for fragile items',
      'Intelligent stock release according to FIFO principles',
      'Temperature and storage condition monitoring'
    ]
  },
  'electronics': {
    titleTr: 'Elektronik & Teknoloji için Depo Yönetimi',
    titleEn: 'Warehouse Management for Electronics & Technology',
    descTr: 'Seri numarası (IMEI) takibi, yüksek değerli ürün güvenliği ve garanti yönetim süreçleriyle teknoloji lojistiğinizi yönetin.',
    descEn: 'Manage your technology logistics with serial number (IMEI) tracking, high-value product security, and warranty management.',
    featuresTr: [
      'Benzersiz seri numarası ve IMEI takibi',
      'Yüksek değerli ürünler için özel güvenlikli alan tanımları',
      'Garanti ve servis takip süreçlerinin entegrasyonu',
      'Parça ve bileşen bazlı montaj yönetimi'
    ],
    featuresEn: [
      'Unique serial number and IMEI tracking',
      'Secure zone definitions for high-value goods',
      'Integration of warranty and service tracking processes',
      'Component-based assembly management'
    ]
  },
  'home-and-garden': {
    titleTr: 'Ev, Yaşam & Bahçe için Depo Yönetimi',
    titleEn: 'Warehouse Management for Home, Living & Garden',
    descTr: 'Hacimli ürün depolama yönetimi, montaj paketleri (kit oluşturma) ve lojistik optimizasyonu ile büyük siparişlerinizi hatasız gönderin.',
    descEn: 'Ship large orders error-free with volumetric storage management, assembly kits creation, and logistics optimization.',
    featuresTr: [
      'Hacimli ve ağır ürünler için özel raf ve yerleşim planlaması',
      'Demonte ürünler için akıllı kit oluşturma (Bundle) yönetimi',
      'Çoklu koli ve palet bazlı sevkiyat takibi',
      'Lojistik ve nakliye firmalarıyla tam entegrasyon'
    ],
    featuresEn: [
      'Special shelf and layout planning for heavy/bulky goods',
      'Smart kit (bundle) management for disassembled products',
      'Multi-box and pallet-based shipment tracking',
      'Full integration with logistics and freight carriers'
    ]
  },
  'automotive-spare-parts': {
    titleTr: 'Otomotiv Yedek Parça için Depo Yönetimi',
    titleEn: 'Warehouse Management for Automotive Spare Parts',
    descTr: 'OEM numarası eşleşmesi, çapraz referanslı ürün takibi ve geniş SKU listeleri için optimize edilmiş depo yerleşimi.',
    descEn: 'OEM number matching, cross-referenced product tracking, and optimized warehouse layout for extensive SKU lists.',
    featuresTr: [
      'OEM ve üretici kodu bazlı arama ve doğrulama',
      'Geniş SKU kütüphaneleri için dinamik adresleme',
      'Çapraz referans ve muadil parça takibi',
      'Hızlı sevkiyat için barkodlu toplama rotaları'
    ],
    featuresEn: [
      'OEM and manufacturer code-based search and verification',
      'Dynamic shelf addressing for large SKU catalogs',
      'Cross-reference and alternative parts tracking',
      'Barcoded picking routes for fast shipment'
    ]
  },
  'food-and-fmcg': {
    titleTr: 'Gıda & Hızlı Tüketim için Depo Yönetimi',
    titleEn: 'Warehouse Management for Food & FMCG',
    descTr: 'Soğuk zincir lojistiği, parti bazlı izlenebilirlik ve son kullanma tarihine duyarlı sipariş hazırlama.',
    descEn: 'Cold chain logistics, batch-based traceability, and expiration date-sensitive order fulfillment.',
    featuresTr: [
      'Soğuk depo ve sıcaklık kontrollü sevkiyat takibi',
      'Parti numarası (Batch) bazlı geriye dönük izlenebilirlik',
      'FEFO (İlk SKT’li İlk Çıkar) kuralına uygun akıllı yönlendirme',
      'Gıda güvenliği standartlarına uygun hijyenik depolama yönetimi'
    ],
    featuresEn: [
      'Cold room and temperature-controlled shipping tracking',
      'Batch number-based backward traceability',
      'Smart routing matching FEFO principles',
      'Hygienic storage management in line with food safety standards'
    ]
  }
};

export default function IndustryPage() {
  const { isAuthenticated } = useAuth();
  const params = useParams();
  
  const locale = (params.locale as string) || 'tr';
  const slug = (params.slug as string) || 'fashion-and-apparel';
  const isTr = locale.startsWith('tr');

  const industry = INDUSTRIES[slug] || INDUSTRIES['fashion-and-apparel'];
  const title = isTr ? industry.titleTr : industry.titleEn;
  const desc = isTr ? industry.descTr : industry.descEn;
  const features = isTr ? industry.featuresTr : industry.featuresEn;

  return (
    <div className="relative min-h-screen w-full bg-kp-bg-primary text-kp-text-primary font-outfit overflow-hidden transition-colors duration-300">
      {/* Background glow animations */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-kp-accent/5 dark:bg-kp-accent/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-600/5 dark:bg-violet-600/10 blur-[140px] pointer-events-none" />

      {/* Main navigation */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-20 flex flex-col items-center">
        {/* Breadcrumb navigation */}
        <div className="w-full flex items-center gap-2 text-xs font-semibold text-kp-text-tertiary mb-8 self-start">
          <Link href={`/${locale}`} className="hover:text-kp-accent transition-colors">
            {isTr ? 'Anasayfa' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-kp-text-secondary">
            {isTr ? 'Sektörler' : 'Industries'}
          </span>
          <span>/</span>
          <span className="text-kp-accent">
            {isTr ? (slug === 'home-and-garden' ? 'Ev, Yaşam & Bahçe' : title.split(' için ')[0]) : title}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full mt-4">
          {/* Main Hero Column */}
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-kp-accent-muted text-kp-accent border border-kp-accent/20">
              {isTr ? 'Sektörel Çözümler' : 'Industry Solutions'}
            </span>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-kp-text-primary leading-tight">
              {title}
            </h1>
            
            <p className="text-base sm:text-lg text-kp-text-secondary leading-relaxed">
              {desc}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href={isAuthenticated ? '/select-tenant' : '/auth/login'}
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white shadow-kp-card hover:shadow-kp-glow transition-all duration-200"
              >
                {isTr ? 'Ücretsiz Deneyin' : 'Start Free Trial'}
              </Link>
              <Link
                href={`/${locale}#contact`}
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-bg-secondary border border-kp-border text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
              >
                {isTr ? 'Uzmanla Görüş' : 'Talk to an Expert'}
              </Link>
            </div>
          </div>

          {/* Features Column */}
          <div className="lg:col-span-5 bg-kp-bg-secondary border border-kp-border p-8 rounded-kp-lg shadow-kp-card relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-kp-accent/5 rounded-bl-full pointer-events-none" />
            <h3 className="text-lg font-bold text-kp-text-primary border-b border-kp-border-subtle pb-4 mb-6">
              {isTr ? 'Öne Çıkan Özellikler' : 'Key Advantages'}
            </h3>
            
            <ul className="space-y-4">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-kp-accent flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-kp-text-secondary leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
