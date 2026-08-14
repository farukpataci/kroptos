'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar/Navbar';
import Footer from '@/components/layout/Footer/Footer';
import { useAuth } from '@/lib/auth-context';
import { useLocale, useTranslations } from 'next-intl';
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

// Custom SVGs for platform metrics and benefits
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

export default function Home() {
  const { isAuthenticated } = useAuth();
  const locale = useLocale();
  const t = useTranslations('marketing.landing');

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
    if (!formData.name.trim()) newErrors.name = t('contact.errors.nameRequired');
    if (!formData.email.trim()) {
      newErrors.email = t('contact.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('contact.errors.emailInvalid');
    }
    if (!formData.phone.trim()) newErrors.phone = t('contact.errors.phoneRequired');
    if (!formData.orderVolume) newErrors.orderVolume = t('contact.errors.volumeRequired');
    if (!formData.agreeKvkk) newErrors.agreeKvkk = t('contact.errors.kvkkRequired');

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

  // General WMS FAQ Items — questions/answers resolved from the message catalog
  const sssItems = Array.from({ length: 8 }, (_, i) => ({
    q: t(`faq.items.q${i + 1}`),
    a: t(`faq.items.a${i + 1}`)
  }));

  return (
    <div className="relative min-h-screen w-full bg-kp-bg-primary text-kp-text-primary font-outfit overflow-hidden transition-colors duration-300">
      {/* Abstract Background Glows */}
      <div className="absolute top-1/6 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-kp-accent/5 dark:bg-kp-accent/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-violet-600/5 dark:bg-violet-600/10 blur-[160px] pointer-events-none" />

      {/* Main navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-kp-accent-muted text-kp-accent border border-kp-accent/20 tracking-wider uppercase">
              {t('badge')}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-kp-text-primary leading-tight">
              {t('heroTitle')}
            </h1>
            <p className="text-base sm:text-lg text-kp-text-secondary leading-relaxed max-w-2xl">
              {t('heroDesc')}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={isAuthenticated ? '/select-tenant' : '/auth/login'}
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white shadow-kp-card hover:shadow-kp-glow transition-all duration-200"
              >
                {t('ctaStart')}
              </Link>
              <a
                href="#contact"
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-bg-secondary border border-kp-border text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
              >
                {t('ctaDemo')}
              </a>
            </div>
          </div>

          {/* Interactive SVG Hero Dashboard Mockup */}
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
              <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold bg-green-500/10 text-green-500 border border-green-500/20">LIVE</span>
            </div>

            {/* Metrics cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 space-y-1">
                <p className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider">{t('mockup.todaysOrders')}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-kp-text-primary">1,482</p>
                  <span className="text-[0.625rem] font-bold text-green-500">+14%</span>
                </div>
              </div>
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 space-y-1">
                <p className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider">{t('mockup.criticalStock')}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-red-500">12</p>
                  <span className="text-[0.625rem] font-semibold text-red-500/70">{t('mockup.sku')}</span>
                </div>
              </div>
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 col-span-2 sm:col-span-1 space-y-1">
                <p className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider">{t('mockup.shippingStatus')}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-kp-accent">98.4%</p>
                  <span className="text-[0.625rem] font-semibold text-kp-text-tertiary">{t('mockup.ontime')}</span>
                </div>
              </div>
            </div>

            {/* Sales Chart Mockup SVG */}
            <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-kp-text-primary">{t('mockup.salesVolume')}</h4>
                <span className="text-[0.625rem] font-semibold text-kp-text-tertiary">10-17 July</span>
              </div>
              <svg className="w-full h-32 text-kp-accent" viewBox="0 0 300 100" fill="none">
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="M0,80 Q25,60 50,70 T100,40 T150,55 T200,30 T250,45 T300,15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,80 Q25,60 50,70 T100,40 T150,55 T200,30 T250,45 T300,15 L300,100 L0,100 Z" fill="url(#chart-grad)" />
                <line x1="0" y1="90" x2="300" y2="90" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1="0" y1="50" x2="300" y2="50" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              </svg>
            </div>

            {/* Activity/Channel lists */}
            <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs border-b border-kp-border-subtle pb-2">
                <span className="font-bold text-kp-text-primary">{t('mockup.connectedChannels')}</span>
                <span className="text-kp-text-tertiary font-medium">5 {t('mockup.active')}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {['Trendyol', 'Hepsiburada', 'Amazon', 'N11', 'ÇiçekSepeti'].map((channel) => (
                  <span key={channel} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-kp-bg-secondary border border-kp-border-subtle text-[0.625rem] font-bold text-kp-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {channel}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Benefit Ribbon */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconShop /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{t('ribbon.unified.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{t('ribbon.unified.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconSync /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{t('ribbon.sync.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{t('ribbon.sync.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconBarcode /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{t('ribbon.barcode.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{t('ribbon.barcode.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconTruck /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{t('ribbon.automation.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{t('ribbon.automation.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problems & Solutions (General copy) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-24">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
            {t('sections.header.title')}
          </h2>
          <p className="text-base text-kp-text-secondary leading-relaxed">
            {t('sections.header.desc')}
          </p>
        </div>

        {/* 1. Çok Kanallı Sipariş Yönetimi */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">01 / {t('sections.orders.tag')}</span>
            <h3 className="text-2xl font-bold text-kp-text-primary">{t('sections.orders.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('sections.orders.desc')}
            </p>
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((n) => t(`sections.orders.f${n}`)).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-semibold text-kp-text-secondary">
                  <CheckCircleIcon className="h-4 w-4 text-kp-accent flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card">
            <h4 className="text-xs font-bold text-kp-text-primary mb-3">{t('sections.orders.panelTitle')}</h4>
            <div className="space-y-2 text-[0.6875rem] font-mono text-kp-text-secondary">
              <div className="flex justify-between p-2 bg-kp-bg-primary rounded">
                <span>Trendyol #294029:</span>
                <span className="font-bold text-green-500">{t('sections.orders.statusPulled')}</span>
              </div>
              <div className="flex justify-between p-2 bg-kp-bg-primary rounded">
                <span>Amazon #849202:</span>
                <span className="font-bold text-kp-accent">{t('sections.orders.statusPacking')}</span>
              </div>
              <div className="flex justify-between p-2 bg-kp-bg-primary rounded">
                <span>Shopify #1092:</span>
                <span className="font-bold text-kp-text-primary">{t('sections.orders.statusShipped')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Akıllı WMS Depo Otomasyonu */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center lg:flex-row-reverse">
          <div className="lg:col-span-6 lg:order-2 space-y-5">
            <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">02 / {t('sections.wms.tag')}</span>
            <h3 className="text-2xl font-bold text-kp-text-primary">{t('sections.wms.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('sections.wms.desc')}
            </p>
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((n) => t(`sections.wms.f${n}`)).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-semibold text-kp-text-secondary">
                  <CheckCircleIcon className="h-4 w-4 text-kp-accent flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6 lg:order-1 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card">
            <h4 className="text-xs font-bold text-kp-text-primary mb-3">{t('sections.wms.panelTitle')}</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-kp-bg-primary border border-kp-border-subtle p-3 rounded text-center space-y-1">
                <span className="font-bold text-kp-text-primary">{t('sections.wms.zoneA')}</span>
                <p className="text-[0.625rem] text-kp-text-tertiary">{t('sections.wms.zoneAItems')}</p>
              </div>
              <div className="bg-kp-bg-primary border border-kp-border-subtle p-3 rounded text-center space-y-1">
                <span className="font-bold text-kp-text-primary">{t('sections.wms.zoneB')}</span>
                <p className="text-[0.625rem] text-kp-text-tertiary">{t('sections.wms.zoneBItems')}</p>
              </div>
              <div className="col-span-2 bg-kp-bg-primary border border-kp-border-subtle p-2 text-center text-[0.625rem] font-mono text-kp-text-secondary">
                {t('sections.wms.autoRouting')}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Gerçek Zamanlı Stok Senkronizasyonu */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">03 / {t('sections.stock.tag')}</span>
            <h3 className="text-2xl font-bold text-kp-text-primary">{t('sections.stock.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('sections.stock.desc')}
            </p>
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((n) => t(`sections.stock.f${n}`)).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-semibold text-kp-text-secondary">
                  <CheckCircleIcon className="h-4 w-4 text-kp-accent flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card">
            <div className="flex items-center justify-between mb-3 text-xs border-b border-kp-border-subtle pb-2">
              <span className="font-bold text-kp-text-primary">{t('sections.stock.panelTitle')}</span>
              <span className="text-kp-text-tertiary">SKU: OUT-LOUNGE-04</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-kp-text-secondary">{t('sections.stock.warehouse1')}</span>
                <span className="font-bold text-kp-text-primary">{t('sections.stock.units', { count: 140 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-kp-text-secondary">{t('sections.stock.warehouse2')}</span>
                <span className="font-bold text-kp-text-primary">{t('sections.stock.units', { count: 45 })}</span>
              </div>
              <div className="flex justify-between text-kp-accent font-semibold pt-1 border-t border-kp-border-subtle">
                <span>{t('sections.stock.reserve')}</span>
                <span>{t('sections.stock.units', { count: -15 })}</span>
              </div>
              <div className="flex justify-between font-bold text-green-500">
                <span>{t('sections.stock.listed')}</span>
                <span>{t('sections.stock.units', { count: 170 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Gelişmiş Paketleme ve Kalite Kontrol */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center lg:flex-row-reverse">
          <div className="lg:col-span-6 lg:order-2 space-y-5">
            <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">04 / {t('sections.packing.tag')}</span>
            <h3 className="text-2xl font-bold text-kp-text-primary">{t('sections.packing.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('sections.packing.desc')}
            </p>
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((n) => t(`sections.packing.f${n}`)).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-semibold text-kp-text-secondary">
                  <CheckCircleIcon className="h-4 w-4 text-kp-accent flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6 lg:order-1 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card">
            <h4 className="text-xs font-bold text-kp-text-primary mb-3">{t('sections.packing.panelTitle')}</h4>
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded text-[0.6875rem] font-bold mb-3 flex items-center gap-2">
              <span className="animate-ping w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              {t('sections.packing.fragileAlert')}
            </div>
            <p className="text-[0.6875rem] text-kp-text-secondary font-mono border-l-2 border-kp-accent pl-3 italic">
              {t('sections.packing.fragileNote')}
            </p>
          </div>
        </div>

        {/* 5. Kargo ve Taşıyıcı Entegrasyonları */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">05 / {t('sections.shipping.tag')}</span>
            <h3 className="text-2xl font-bold text-kp-text-primary">{t('sections.shipping.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('sections.shipping.desc')}
            </p>
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((n) => t(`sections.shipping.f${n}`)).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-semibold text-kp-text-secondary">
                  <CheckCircleIcon className="h-4 w-4 text-kp-accent flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card">
            <h4 className="text-xs font-bold text-kp-text-primary mb-3">{t('sections.shipping.panelTitle')}</h4>
            <div className="space-y-2 text-[0.6875rem] font-mono text-kp-text-secondary">
              <div className="flex justify-between p-2 bg-kp-bg-primary rounded">
                <span>{t('sections.shipping.carrierLabel')}</span>
                <span className="font-bold text-kp-text-primary">MNG Kargo</span>
              </div>
              <div className="flex justify-between p-2 bg-kp-bg-primary rounded">
                <span>{t('sections.shipping.dispatchLabel')}</span>
                <span className="font-bold text-green-500">{t('sections.shipping.dispatchValue')}</span>
              </div>
              <div className="flex justify-between p-2 bg-kp-bg-primary rounded">
                <span>{t('sections.shipping.notifyLabel')}</span>
                <span className="font-bold text-kp-accent">{t('sections.shipping.notifyValue')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Çok Kanallı ve Sınır Ötesi Satış */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center lg:flex-row-reverse">
          <div className="lg:col-span-6 lg:order-2 space-y-5">
            <span className="text-xs font-bold text-kp-accent uppercase tracking-wider">06 / {t('sections.growth.tag')}</span>
            <h3 className="text-2xl font-bold text-kp-text-primary">{t('sections.growth.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('sections.growth.desc')}
            </p>
            <div className="space-y-4 pt-2">
              <div>
                <p className="text-xs font-bold text-kp-text-primary uppercase tracking-wider mb-2">{t('sections.growth.activeIntegrations')}</p>
                <div className="flex flex-wrap gap-2">
                  {['Trendyol', 'Hepsiburada', 'Amazon', 'N11', 'ÇiçekSepeti'].map((c) => (
                    <span key={c} className="px-2 py-1 rounded bg-kp-accent-muted/20 border border-kp-accent/20 text-xs font-semibold text-kp-accent">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-kp-text-tertiary uppercase tracking-wider mb-2">{t('sections.growth.plannedIntegrations')}</p>
                <div className="flex flex-wrap gap-2">
                  {['Shopify', 'WooCommerce', 'Pazarama'].map((c) => (
                    <span key={c} className="px-2 py-1 rounded bg-kp-bg-secondary border border-kp-border text-xs font-medium text-kp-text-tertiary">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6 lg:order-1 bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card flex items-center justify-center">
            {/* Visual connected grid drawing */}
            <div className="flex flex-col items-center gap-4 py-6 w-full">
              <div className="px-4 py-2 bg-kp-accent text-white font-extrabold rounded shadow-md">ALQORA HUB</div>
              <div className="h-8 w-0.5 bg-kp-border-accent" />
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm text-center text-[0.625rem] font-bold">
                <div className="p-2 border border-kp-border bg-kp-bg-primary rounded text-kp-text-primary">Trendyol</div>
                <div className="p-2 border border-kp-border bg-kp-bg-primary rounded text-kp-text-primary">Hepsiburada</div>
                <div className="p-2 border border-kp-border bg-kp-bg-primary rounded text-kp-text-primary">Amazon</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations grid */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
              {t('integrations.title')}
            </h2>
            <p className="text-base text-kp-text-secondary">
              {t('integrations.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Trendyol', key: 'trendyol', active: true },
              { name: 'Hepsiburada', key: 'hepsiburada', active: true },
              { name: 'Amazon', key: 'amazon', active: true },
              { name: 'Shopify', key: 'shopify', active: false }
            ].map((card) => ({
              ...card,
              status: card.active ? t('integrations.statusActive') : t('integrations.statusPlanned'),
              features: [1, 2, 3].map((n) => t(`integrations.cards.${card.key}.f${n}`))
            })).map((p, idx) => (
              <div key={idx} className="bg-kp-bg-primary border border-kp-border rounded-kp-lg p-6 text-left space-y-4 shadow-kp-card hover:border-kp-accent/40 transition-colors">
                <div className="flex items-center justify-between border-b border-kp-border-subtle pb-3">
                  <h4 className="text-sm font-bold text-kp-text-primary">{p.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-[0.625rem] font-bold ${
                    p.active
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
                  {t('integrations.review')}
                  <span>→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Operational Capabilities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
            {t('capabilities.title')}
          </h2>
          <p className="text-base text-kp-text-secondary">
            {t('capabilities.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{t('capabilities.pricing.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('capabilities.pricing.desc')}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{t('capabilities.returns.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('capabilities.returns.desc')}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{t('capabilities.erp.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('capabilities.erp.desc')}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-4">
            <h3 className="text-lg font-bold text-kp-text-primary">{t('capabilities.workflow.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {t('capabilities.workflow.desc')}
            </p>
            <div className="space-y-1.5 font-mono text-[0.625rem] text-kp-text-tertiary">
              <p>✔ {t('capabilities.workflow.rule1')}</p>
              <p>✔ {t('capabilities.workflow.rule2')}</p>
              <p>✔ {t('capabilities.workflow.rule3')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
              {t('howItWorks.title')}
            </h2>
            <p className="text-base text-kp-text-secondary">
              {t('howItWorks.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[1, 2, 3, 4].map((n) => ({
              step: `0${n}`,
              title: t(`howItWorks.steps.s${n}.title`),
              desc: t(`howItWorks.steps.s${n}.desc`)
            })).map((s, idx) => (
              <div key={idx} className="space-y-3 text-center md:text-left relative z-10 bg-kp-bg-primary border border-kp-border p-5 rounded-kp-lg shadow-kp-card">
                <span className="text-3xl font-extrabold text-kp-accent/20 block">{s.step}</span>
                <h4 className="text-base font-bold text-kp-text-primary">{s.title}</h4>
                <p className="text-xs text-kp-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live statistics view */}
      <section className="bg-slate-950 text-slate-100 py-20 relative border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12 relative z-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {t('stats.title')}
            </h2>
            <p className="text-base text-slate-400">
              {t('stats.desc')}
            </p>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-kp-lg p-6 max-w-4xl mx-auto shadow-2xl text-left space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ALQORA WMS // LIVE STATISTICS</span>
              <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold bg-green-500/10 text-green-500 border border-green-500/20">SYSTEM HEALTHY</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{t('mockup.todaysOrders')}</p>
                <p className="text-xl font-bold text-white mt-1">2,840</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{t('stats.pendingPicking')}</p>
                <p className="text-xl font-bold text-yellow-500 mt-1">114</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{t('stats.criticalSku')}</p>
                <p className="text-xl font-bold text-red-500 mt-1">12</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{t('stats.delayedShipments')}</p>
                <p className="text-xl font-bold text-white mt-1">0</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 border border-white/5 rounded space-y-2 col-span-2">
                <div className="flex justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
                  <span className="font-bold">{t('stats.depotEfficiency')}</span>
                  <span>July 2026</span>
                </div>
                <div className="space-y-3 pt-1 text-[0.6875rem]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{t('stats.pickingAccuracy')}</span>
                      <span className="font-bold text-green-500">99.9%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[99.9%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{t('stats.packingSpeed')}</span>
                      <span className="font-bold text-kp-accent">94.8%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-kp-accent h-full w-[94.8%]" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-950 p-4 border border-white/5 rounded space-y-3 text-xs">
                <div className="text-slate-400 font-bold border-b border-white/5 pb-2">{t('stats.returnsTimes')}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('stats.avgPickingTime')}</span>
                    <span className="font-bold text-white">4.2 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('stats.returnRate')}</span>
                    <span className="font-bold text-white">1.8%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form area */}
      <section id="contact" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-8 shadow-kp-dropdown space-y-8 relative">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">
              {t('contact.title')}
            </h2>
            <p className="text-sm text-kp-text-secondary">
              {t('contact.desc')}
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-6 rounded-kp-md text-center space-y-3 animate-scale-in">
              <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto" />
              <h4 className="text-lg font-bold">{t('contact.successTitle')}</h4>
              <p className="text-sm text-kp-text-secondary max-w-md mx-auto">
                {t('contact.successDesc')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                    {t('contact.nameLabel')}
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
                    {t('contact.emailLabel')}
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
                    {t('contact.phoneLabel')}
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
                    {t('contact.volumeLabel')}
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
                    <option value="">{t('contact.volumePlaceholder')}</option>
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
                  {t('contact.channelsLabel')}
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
                    {t('contact.kvkkLabel')}
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
                    {t('contact.submitting')}
                  </>
                ) : (
                  t('contact.submit')
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* SSS section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-kp-border">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <h2 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">
            {t('faq.title')}
          </h2>
          <p className="text-sm text-kp-text-secondary">
            {t('faq.desc')}
          </p>
        </div>

        <div className="space-y-1">
          {sssItems.map((item, idx) => {
            const q = item.q;
            const a = item.a;
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
