'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import NavCTAButtons from './NavCTAButtons';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNavigationDrawer({ isOpen, onClose }: MobileNavigationDrawerProps) {
  const locale = useLocale();
  const isTr = locale === 'tr';

  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleAccordion = (name: string) => {
    setActiveAccordion(activeAccordion === name ? null : name);
  };

  if (!isOpen) return null;

  const data = {
    features: {
      title: isTr ? 'Platform Özellikleri' : 'Platform Features',
      sections: [
        {
          group: isTr ? 'Operasyon Yönetimi' : 'Operations Management',
          items: [
            isTr ? 'Sipariş Yönetimi' : 'Order Management',
            isTr ? 'Ürün & Katalog Yönetimi' : 'Product & Catalog Management',
            isTr ? 'Stok Yönetimi' : 'Inventory Management',
            isTr ? 'Fiyat Otomasyonu' : 'Price Automation'
          ]
        },
        {
          group: isTr ? 'Lojistik & Depo' : 'Logistics & Warehouse',
          items: [
            isTr ? 'WMS / Depo Yönetimi' : 'WMS / Warehouse Management',
            isTr ? 'Kargo Yönetimi' : 'Shipping Management',
            isTr ? 'İade Yönetimi' : 'Return Management',
            isTr ? 'Etiket & Yazıcı Merkezi' : 'Label & Printer Hub'
          ]
        },
        {
          group: isTr ? 'Otomasyon & Zekâ' : 'Automation & Intelligence',
          items: [
            isTr ? 'İş Akışı Otomasyonu' : 'Workflow Automation',
            isTr ? 'Yapay Zekâ Asistanı' : 'AI Assistant',
            isTr ? 'Analitik & Raporlama' : 'Analytics & Reporting',
            isTr ? 'B2B & Tedarikçi Ağı' : 'B2B & Supplier Network'
          ]
        }
      ]
    },
    solutions: {
      title: isTr ? 'Çözümler' : 'Solutions',
      sections: [
        {
          group: isTr ? 'Ölçeğe Göre' : 'By Size',
          items: [
            isTr ? 'Yeni Başlayan Markalar' : 'Startup Brands',
            isTr ? 'Büyüyen E-Ticaret' : 'Growing E-Commerce',
            isTr ? 'Çok Kanallı Perakende' : 'Omnichannel Retail',
            isTr ? 'Kurumsal Enterprise' : 'Enterprise'
          ]
        },
        {
          group: isTr ? 'İş Modeline Göre' : 'By Business Model',
          items: [
            isTr ? 'Pazaryeri Satıcıları' : 'Marketplace Sellers',
            isTr ? 'Kendi E-Ticaret Sitesi' : 'Own E-Commerce Sites',
            isTr ? 'B2B Toptan Satış' : 'B2B Wholesale',
            isTr ? '3PL / Fulfillment' : '3PL / Fulfillment'
          ]
        }
      ]
    },
    resources: {
      title: isTr ? 'Kaynaklar' : 'Resources',
      sections: [
        {
          group: isTr ? 'Öğren' : 'Learn',
          items: [
            isTr ? 'Yardım Merkezi' : 'Help Center',
            isTr ? 'Alqora Akademi' : 'Alqora Academy',
            isTr ? 'Blog' : 'Blog',
            isTr ? 'API Dokümantasyonu' : 'API Docs'
          ]
        },
        {
          group: isTr ? 'Hizmetler' : 'Services',
          items: [
            isTr ? 'Sistem Kurulumu' : 'System Setup',
            isTr ? 'Entegrasyon Danışmanlığı' : 'Consultancy',
            isTr ? 'Teknik Destek' : 'Technical Support'
          ]
        }
      ]
    }
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Dark Overlay backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-kp-bg-secondary border-l border-kp-border flex flex-col shadow-kp-elevated p-6 overflow-y-auto">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-6 border-b border-kp-border">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-kp-text-primary">
              Alqora
            </span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
            aria-label="Kapat"
          >
            <XMarkIcon className="h-5.5 w-5.5" />
          </button>
        </div>

        {/* Navigation Accordions List */}
        <div className="flex-1 py-6 space-y-3">
          
          {/* Platform Özellikleri (Accordion) */}
          <div className="border-b border-kp-border pb-3">
            <button
              onClick={() => toggleAccordion('features')}
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{data.features.title}</span>
              {activeAccordion === 'features' ? (
                <ChevronUpIcon className="h-4 w-4 text-kp-accent" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary" />
              )}
            </button>
            {activeAccordion === 'features' && (
              <div className="pl-3 mt-2 space-y-4 animate-fade-in">
                {data.features.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{sec.group}</p>
                    <ul className="space-y-1">
                      {sec.items.map((item, i) => (
                        <li key={i}>
                          <Link
                            onClick={onClose}
                            href={`#feature-${i}`}
                            className="text-xs text-kp-text-secondary hover:text-kp-accent py-1 block transition-colors"
                          >
                            • {item}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Çözümler (Accordion) */}
          <div className="border-b border-kp-border pb-3">
            <button
              onClick={() => toggleAccordion('solutions')}
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{data.solutions.title}</span>
              {activeAccordion === 'solutions' ? (
                <ChevronUpIcon className="h-4 w-4 text-kp-accent" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary" />
              )}
            </button>
            {activeAccordion === 'solutions' && (
              <div className="pl-3 mt-2 space-y-4 animate-fade-in">
                {data.solutions.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{sec.group}</p>
                    <ul className="space-y-1">
                      {sec.items.map((item, i) => (
                        <li key={i}>
                          <Link
                            onClick={onClose}
                            href={`#solutions-${i}`}
                            className="text-xs text-kp-text-secondary hover:text-kp-accent py-1 block transition-colors"
                          >
                            • {item}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Entegrasyonlar (Direct link) */}
          <div className="border-b border-kp-border pb-3">
            <Link
              onClick={onClose}
              href="/integrations"
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{isTr ? 'Entegrasyonlar' : 'Integrations'}</span>
            </Link>
          </div>

          {/* Fiyatlandırma (Direct link) */}
          <div className="border-b border-kp-border pb-3">
            <Link
              onClick={onClose}
              href="/pricing"
              className="flex w-full py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              {isTr ? 'Fiyatlandırma' : 'Pricing'}
            </Link>
          </div>

          {/* Kaynaklar (Accordion) */}
          <div className="border-b border-kp-border pb-3">
            <button
              onClick={() => toggleAccordion('resources')}
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{data.resources.title}</span>
              {activeAccordion === 'resources' ? (
                <ChevronUpIcon className="h-4 w-4 text-kp-accent" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary" />
              )}
            </button>
            {activeAccordion === 'resources' && (
              <div className="pl-3 mt-2 space-y-4 animate-fade-in">
                {data.resources.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{sec.group}</p>
                    <ul className="space-y-1">
                      {sec.items.map((item, i) => (
                        <li key={i}>
                          <Link
                            onClick={onClose}
                            href={`#resource-${i}`}
                            className="text-xs text-kp-text-secondary hover:text-kp-accent py-1 block transition-colors"
                          >
                            • {item}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Drawer Footer Buttons */}
        <div className="pt-6 border-t border-kp-border space-y-4">
          <NavCTAButtons
            className="flex-col w-full !gap-3 *:w-full *:text-center"
            showLanguageSwitcher={true}
          />
        </div>
      </div>
    </div>
  );
}
