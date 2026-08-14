'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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

/* ------------------------------------------------------------------ *
 * FASHION & APPAREL — sector-specific mockups
 * Rendered only when slug === 'fashion-and-apparel'. These are what set
 * this page apart visually from the other industry landings.
 * All copy is resolved from the `industry.fashionMockups` namespace.
 * ------------------------------------------------------------------ */

// 3.2 — Parent → Child SKU variant matrix (size × color)
const VARIANT_SIZES = ['S', 'M', 'L', 'XL'];
const VARIANT_ROWS: { dot: string; color: string; stock: number[] }[] = [
  { dot: '🔴', color: 'RED', stock: [120, 120, 85, 40] },
  { dot: '🔵', color: 'BLUE', stock: [64, 90, 110, 22] },
  { dot: '⚫', color: 'BLACK', stock: [210, 180, 150, 95] },
  { dot: '⚪', color: 'WHITE', stock: [58, 74, 31, 0] }
];

function FashionVariantMatrix() {
  const t = useTranslations('industry.fashionMockups.variantMatrix');

  // Low stock under 40 units, depleted at zero — mirrors the live console rules
  const cellTone = (qty: number) =>
    qty === 0 ? 'text-kp-danger' : qty <= 40 ? 'text-kp-warning' : 'text-kp-text-primary';

  const total = VARIANT_ROWS.reduce((sum, r) => sum + r.stock.reduce((a, b) => a + b, 0), 0);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-kp-text-primary">
          {t('title')}
        </h4>
        <span className="font-mono text-[0.625rem] text-kp-text-tertiary">
          Parent SKU: TSHIRT-BASIC-001
        </span>
      </div>

      <div className="font-mono text-[0.6875rem]">
        {/* Size header row */}
        <div className="grid grid-cols-5 gap-1.5 mb-1.5">
          <span className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider self-end pb-1">
            {t('color')}
          </span>
          {VARIANT_SIZES.map((size) => (
            <span key={size} className="text-center text-[0.625rem] font-bold text-kp-text-tertiary pb-1">
              {size}
            </span>
          ))}
        </div>

        {/* Color rows × size cells */}
        <div className="space-y-1.5">
          {VARIANT_ROWS.map((row) => (
            <div key={row.color} className="grid grid-cols-5 gap-1.5">
              <span className="flex items-center gap-1.5 text-kp-text-secondary font-bold">
                <span aria-hidden="true">{row.dot}</span>
                {row.color}
              </span>
              {row.stock.map((qty, i) => (
                <span
                  key={`${row.color}-${VARIANT_SIZES[i]}`}
                  className={`bg-kp-bg-primary border border-kp-border-subtle rounded py-1.5 text-center font-bold ${cellTone(qty)}`}
                >
                  {qty === 0 ? t('out') : qty}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + rollup */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-kp-border-subtle font-mono text-[0.625rem]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-kp-text-tertiary">
            <span className="w-1.5 h-1.5 rounded-full bg-kp-warning" />
            {t('lowStock')}
          </span>
          <span className="flex items-center gap-1.5 text-kp-text-tertiary">
            <span className="w-1.5 h-1.5 rounded-full bg-kp-danger" />
            {t('depleted')}
          </span>
        </div>
        <span className="text-kp-accent font-bold">
          {t('summary', { total })}
        </span>
      </div>
    </>
  );
}

// 3.3 — Hanging vs boxed storage split view
function FashionWarehouseSplit() {
  const t = useTranslations('industry.fashionMockups.warehouseSplit');

  const hanging = [
    { name: t('items.jacket'), loc: 'H-12-A' },
    { name: t('items.dress'), loc: 'H-12-B' },
    { name: t('items.suit'), loc: 'H-13-C' }
  ];
  const boxed = [
    { name: t('items.tshirt'), loc: 'A-42-H' },
    { name: t('items.sweatshirt'), loc: 'A-43-A' },
    { name: t('items.underwear'), loc: 'A-44-D' }
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-kp-text-primary">
          {t('title')}
        </h4>
        <span className="font-mono text-[0.625rem] text-kp-text-tertiary">
          {t('zonesActive')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 font-mono text-[0.6875rem]">
        {/* Hanging zone */}
        <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 pb-2 border-b border-kp-border-subtle">
            <svg className="h-3.5 w-3.5 text-kp-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5a1.75 1.75 0 111.75 1.75c-.966 0-1.75.784-1.75 1.75M12 11v1.5m-9 6L12 13l9 5.5H3z" />
            </svg>
            <span className="font-bold text-kp-text-primary">
              {t('hanging')} — Zone H
            </span>
          </div>
          {hanging.map((item) => (
            <div key={item.loc} className="flex items-center justify-between text-kp-text-secondary">
              <span>{item.name}</span>
              <span className="text-kp-text-tertiary">{item.loc}</span>
            </div>
          ))}
        </div>

        {/* Boxed zone */}
        <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 pb-2 border-b border-kp-border-subtle">
            <svg className="h-3.5 w-3.5 text-kp-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-8.25-4.5-8.25 4.5m16.5 0v9l-8.25 4.5m8.25-13.5L12 12m0 9L3.75 16.5v-9M12 12L3.75 7.5M12 12v9" />
            </svg>
            <span className="font-bold text-kp-text-primary">
              {t('boxed')} — Zone A
            </span>
          </div>
          {boxed.map((item) => (
            <div key={item.loc} className="flex items-center justify-between text-kp-text-secondary">
              <span>{item.name}</span>
              <span className="text-kp-text-tertiary">{item.loc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 bg-kp-accent-muted border border-kp-accent/20 rounded p-2.5 flex items-center justify-between font-mono text-[0.625rem]">
        <span className="font-bold text-kp-accent">
          {t('optimizedRoute')}
        </span>
        <span className="text-kp-accent">
          {t('steps')}
        </span>
      </div>
    </>
  );
}

// 3.4 — Return processing funnel
function FashionReturnFunnel() {
  const t = useTranslations('industry.fashionMockups.returnFunnel');

  const steps = [
    { label: t('step1'), meta: t('step1Meta') },
    { label: t('step2'), meta: 'RET-2026-4471' },
    { label: t('step3'), meta: t('step3Meta') }
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-kp-text-primary">
          {t('title')}
        </h4>
        <span className="font-mono text-[0.625rem] text-kp-text-tertiary">
          {t('processedToday')}{' '}
          <span className="font-bold text-kp-text-primary">312</span>
        </span>
      </div>

      <div className="font-mono text-[0.6875rem] space-y-2">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-kp-text-primary">
                <span className="text-kp-accent">{String(i + 1).padStart(2, '0')}</span>
                {step.label}
              </span>
              <span className="text-kp-text-tertiary">{step.meta}</span>
            </div>
            <div className="text-center text-kp-text-tertiary leading-none py-1">↓</div>
          </div>
        ))}

        {/* Branch: restock vs quarantine */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-kp-bg-primary border border-green-500/20 rounded p-3 space-y-1">
            <span className="block font-bold text-green-500">
              {t('passLabel')}
            </span>
            <span className="block text-kp-text-tertiary">
              {t('passMeta')}
            </span>
          </div>
          <div className="bg-kp-bg-primary border border-yellow-500/20 rounded p-3 space-y-1">
            <span className="block font-bold text-yellow-500">
              {t('failLabel')}
            </span>
            <span className="block text-kp-text-tertiary">
              {t('failMeta')}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// 3.5 — Season transition strip
function FashionSeasonStrip() {
  const t = useTranslations('industry.fashionMockups.seasonStrip');

  const phases = [
    { label: t('preOrder'), fill: 25, active: false },
    { label: t('launch'), fill: 60, active: false },
    { label: t('peak'), fill: 88, active: true },
    { label: t('discount'), fill: 45, active: false },
    { label: t('seasonEnd'), fill: 12, active: false }
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-kp-text-primary">
          {t('title')}
        </h4>
        <span className="font-mono text-[0.625rem] text-kp-text-tertiary">SS26</span>
      </div>

      <div className="flex items-stretch gap-1.5 font-mono text-[0.625rem]">
        {phases.map((phase) => (
          <div key={phase.label} className="flex-1 space-y-1.5">
            <div
              className={`rounded px-1.5 py-2 text-center font-bold border ${
                phase.active
                  ? 'bg-kp-accent-muted text-kp-accent border-kp-accent/20'
                  : 'bg-kp-bg-primary text-kp-text-secondary border-kp-border-subtle'
              }`}
            >
              {phase.label}
            </div>
            {/* Reserve / buffer stock level for the phase */}
            <div className="h-1 rounded-full bg-kp-accent/20 overflow-hidden">
              <div className="h-full bg-kp-accent rounded-full" style={{ width: `${phase.fill}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-kp-border-subtle grid grid-cols-2 gap-3 font-mono text-[0.625rem]">
        <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-2.5">
          <span className="block text-kp-text-tertiary">
            {t('preOrderAllocation')}
          </span>
          <span className="block font-bold text-kp-text-primary mt-0.5">1,200 / 3,000</span>
        </div>
        <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-2.5">
          <span className="block text-kp-text-tertiary">
            {t('safetyBuffer')}
          </span>
          <span className="block font-bold text-kp-accent mt-0.5">
            {t('reserved')}
          </span>
        </div>
      </div>
    </>
  );
}

// 3.6 — Marketplace size chart mapping
const SIZE_MAP: { alqora: string; trendyol: string; hepsiburada: string; amazon: string | null }[] = [
  { alqora: 'S', trendyol: 'S', hepsiburada: '36', amazon: 'Small' },
  { alqora: 'M', trendyol: 'M', hepsiburada: '38', amazon: 'Medium' },
  { alqora: 'L', trendyol: 'L', hepsiburada: '40', amazon: 'Large' },
  { alqora: 'XL', trendyol: 'XL', hepsiburada: '42', amazon: null }
];

function FashionSizeMapping() {
  const t = useTranslations('industry.fashionMockups.sizeMapping');
  const unmapped = SIZE_MAP.filter((r) => r.amazon === null).length;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-kp-text-primary">
          {t('title')}
        </h4>
        <span className="font-mono text-[0.625rem] text-kp-text-tertiary">
          {t('channels')}
        </span>
      </div>

      <div className="font-mono text-[0.6875rem]">
        <div className="grid grid-cols-4 gap-2 border-b border-kp-border font-bold text-kp-text-primary pb-1.5 mb-1.5">
          <span>Alqora</span>
          <span>Trendyol</span>
          <span>Hepsiburada</span>
          <span>Amazon</span>
        </div>
        <div className="space-y-1.5">
          {SIZE_MAP.map((row) => (
            <div key={row.alqora} className="grid grid-cols-4 gap-2 text-kp-text-secondary">
              <span className="font-bold text-kp-text-primary">{row.alqora}</span>
              <span>{row.trendyol}</span>
              <span>{row.hepsiburada}</span>
              <span className={row.amazon ? '' : 'text-kp-warning font-bold'}>
                {row.amazon ?? t('unmapped')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-kp-border-subtle font-mono text-[0.625rem] flex items-center gap-1.5 text-kp-warning">
        <span className="w-1.5 h-1.5 rounded-full bg-kp-warning flex-shrink-0" />
        <span>
          {t('unmappedWarning', { count: unmapped })}
        </span>
      </div>
    </>
  );
}

// Solution index → fashion-specific mockup. Index 4 (shipping speed) intentionally
// falls back to the shared validation console.
const FASHION_MOCKUPS: Record<number, () => React.ReactElement> = {
  0: FashionVariantMatrix,
  1: FashionWarehouseSplit,
  2: FashionReturnFunnel,
  3: FashionSeasonStrip,
  5: FashionSizeMapping
};

// Struct for Sector content mapping — values are message keys under the
// `industry` namespace, resolved with t() at render time. The language layer
// lives entirely in messages/*.json; only structural data remains here.
type MockupType = 'variant' | 'expiry' | 'imei' | 'desi' | 'oem' | 'coldchain';

interface SolutionSection {
  num: string;
  tag: string;
  title: string;
  desc: string;
  features: string[];
  mockupType: MockupType;
}

interface SectorData {
  title: string;
  tag: string;
  h1: string;
  desc: string;
  metrics: { label: string; val: string; trend: string }[];
  solutions: SolutionSection[];
  faqs: { q: string; a: string }[];
}

// Builds the per-sector key map (e.g. title: 'sectors.fashion-and-apparel.title')
function buildSectorData(slug: string, mockupType: MockupType, faqCount: number): SectorData {
  const base = `sectors.${slug}`;
  return {
    title: `${base}.title`,
    tag: `${base}.tag`,
    h1: `${base}.h1`,
    desc: `${base}.desc`,
    metrics: [1, 2, 3].map((n) => ({
      label: `${base}.metrics.m${n}.label`,
      val: `${base}.metrics.m${n}.val`,
      trend: `${base}.metrics.m${n}.trend`
    })),
    solutions: [1, 2, 3, 4, 5, 6].map((n) => ({
      num: `0${n}`,
      tag: `${base}.solutions.s${n}.tag`,
      title: `${base}.solutions.s${n}.title`,
      desc: `${base}.solutions.s${n}.desc`,
      features: [1, 2, 3, 4, 5, 6].map((f) => `${base}.solutions.s${n}.f${f}`),
      mockupType
    })),
    faqs: Array.from({ length: faqCount }, (_, i) => ({
      q: `${base}.faqs.q${i + 1}`,
      a: `${base}.faqs.a${i + 1}`
    }))
  };
}

const SECTOR_DATA_MAP: Record<string, SectorData> = {
  'home-and-garden': buildSectorData('home-and-garden', 'desi', 0),
  'fashion-and-apparel': buildSectorData('fashion-and-apparel', 'variant', 5),
  'cosmetics-and-personal-care': buildSectorData('cosmetics-and-personal-care', 'expiry', 0),
  'electronics': buildSectorData('electronics', 'imei', 0),
  'automotive-spare-parts': buildSectorData('automotive-spare-parts', 'oem', 0),
  'food-and-fmcg': buildSectorData('food-and-fmcg', 'coldchain', 0)
};

export default function SolutionDetail() {
  const { isAuthenticated } = useAuth();
  const params = useParams();

  const locale = (params.locale as string) || 'tr';
  const slug = (params.slug as string) || 'home-and-garden';

  // ti: industry namespace (sector content + industry-specific template copy)
  // tl: shared marketing landing copy reused verbatim on this template
  const ti = useTranslations('industry');
  const tl = useTranslations('marketing.landing');

  // Find data for this sector, fallback to home-and-garden if not found
  const sectorData = SECTOR_DATA_MAP[slug] || SECTOR_DATA_MAP['home-and-garden'];

  // Construct dynamic FAQ list based on current sector to make it personalized!
  const sssItems =
    sectorData.faqs.length > 0
      ? sectorData.faqs.map((f) => ({ q: ti(f.q), a: ti(f.a) }))
      : [1, 2, 3, 4].map((n) => ({ q: ti(`common.faqs.q${n}`), a: ti(`common.faqs.a${n}`) }));

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
    document.title = ti(sectorData.title);

    // Set meta description
    const descEl = document.querySelector('meta[name="description"]');
    const descText = ti(sectorData.desc);
    if (descEl) {
      descEl.setAttribute('content', descText);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = descText;
      document.head.appendChild(meta);
    }
  }, [ti, sectorData]);

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
    if (!formData.name.trim()) newErrors.name = tl('contact.errors.nameRequired');
    if (!formData.email.trim()) {
      newErrors.email = tl('contact.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = tl('contact.errors.emailInvalid');
    }
    if (!formData.phone.trim()) newErrors.phone = tl('contact.errors.phoneRequired');
    if (!formData.orderVolume) newErrors.orderVolume = tl('contact.errors.volumeRequired');
    if (!formData.agreeKvkk) newErrors.agreeKvkk = tl('contact.errors.kvkkRequired');

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

  const activeMetrics = sectorData.metrics.map((m) => ({
    label: ti(m.label),
    val: ti(m.val),
    trend: ti(m.trend)
  }));

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
              {ti(sectorData.tag)}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-kp-text-primary leading-tight">
              {ti(sectorData.h1)}
            </h1>
            <p className="text-base sm:text-lg text-kp-text-secondary leading-relaxed max-w-2xl">
              {ti(sectorData.desc)}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={isAuthenticated ? '/select-tenant' : '/auth/login'}
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white shadow-kp-card hover:shadow-kp-glow transition-all duration-200"
              >
                {tl('ctaStart')}
              </Link>
              <a
                href="#contact"
                className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-bg-secondary border border-kp-border text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
              >
                {tl('ctaDemo')}
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
              <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold bg-green-500/10 text-green-500 border border-green-500/20">LIVE</span>
            </div>

            {/* Metrics cards grid driven by sector data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {activeMetrics.map((m, idx) => (
                <div key={idx} className="bg-kp-bg-primary border border-kp-border-subtle rounded p-3 space-y-1">
                  <p className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider">{m.label}</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-base sm:text-lg font-bold text-kp-text-primary">{m.val}</p>
                    <span className={`text-[0.625rem] font-bold ${
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
                  <span>{ti('common.heroMock.variant.c1')}</span>
                  <span>{ti('common.heroMock.variant.c2')}</span>
                  <span>{ti('common.heroMock.variant.c3')}</span>
                </div>
                <div className="space-y-1 text-[0.6875rem] text-kp-text-secondary">
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
                  <span>{ti('common.heroMock.lot.c1')}</span>
                  <span>{ti('common.heroMock.lot.c2')}</span>
                  <span>{ti('common.heroMock.lot.c3')}</span>
                </div>
                <div className="space-y-1 text-[0.6875rem] text-kp-text-secondary">
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
                    <span>{ti('common.heroMock.lot.nearExpiry')}</span>
                  </div>
                </div>
              </div>
            ) : slug === 'electronics' ? (
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4 text-xs font-mono">
                <div className="flex justify-between border-b border-kp-border pb-1.5 font-bold mb-2">
                  <span>{ti('common.heroMock.imei.c1')}</span>
                  <span>{ti('common.heroMock.imei.c2')}</span>
                  <span>{ti('common.heroMock.imei.c3')}</span>
                </div>
                <div className="space-y-1 text-[0.6875rem] text-kp-text-secondary">
                  <div className="flex justify-between">
                    <span>SN-98402940294</span>
                    <span>INV-2026-902</span>
                    <span className="text-kp-accent">{ti('common.heroMock.imei.months')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SN-84920294921</span>
                    <span>INV-2026-903</span>
                    <span className="text-kp-accent">{ti('common.heroMock.imei.months')}</span>
                  </div>
                  <div className="flex justify-between text-green-500">
                    <span>SN-10920492049</span>
                    <span>INV-2026-904</span>
                    <span>{ti('common.heroMock.imei.active')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-kp-bg-primary border border-kp-border-subtle rounded p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-kp-text-primary">{ti('common.weeklyTrends')}</h4>
                  <span className="text-[0.625rem] font-semibold text-kp-text-tertiary">10-17 July</span>
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
                <span className="font-bold text-kp-text-primary">{tl('mockup.connectedChannels')}</span>
                <span className="text-kp-text-tertiary font-medium">5 {tl('mockup.active')}</span>
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

      {/* 6. TRUST & BENEFIT SHIELD */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconShop /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{tl('ribbon.unified.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{tl('ribbon.unified.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconSync /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{tl('ribbon.sync.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{tl('ribbon.sync.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconBarcode /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{tl('ribbon.barcode.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{tl('ribbon.barcode.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="mt-1 flex-shrink-0"><IconTruck /></div>
              <div>
                <h4 className="text-sm font-bold text-kp-text-primary">{tl('ribbon.automation.title')}</h4>
                <p className="text-xs text-kp-text-secondary mt-1">{tl('ribbon.automation.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PROBLEM & SOLUTIONS SECTIONS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-24">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
            {ti('common.sectionsHeaderTitle')}
          </h2>
          <p className="text-base text-kp-text-secondary leading-relaxed">
            {ti('common.sectionsHeaderDesc')}
          </p>
        </div>

        {/* Loop through solutions dynamic listings */}
        {sectorData.solutions.map((sol, idx) => {
          const title = ti(sol.title);
          const desc = ti(sol.desc);
          const tag = ti(sol.tag);
          const features = sol.features.map((f) => ti(f));
          // Fashion gets its own per-solution visualization instead of the shared console
          const FashionMockup = slug === 'fashion-and-apparel' ? FASHION_MOCKUPS[idx] : undefined;

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
                {FashionMockup ? (
                  <FashionMockup />
                ) : (
                  <>
                    <h4 className="text-xs font-bold text-kp-text-primary mb-3">{ti('common.validationConsole')}</h4>
                    <div className="space-y-3 font-mono text-[0.625rem] text-kp-text-secondary">
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
                  </>
                )}
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
              {tl('integrations.title')}
            </h2>
            <p className="text-base text-kp-text-secondary">
              {tl('integrations.desc')}
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
              status: card.active ? tl('integrations.statusActive') : tl('integrations.statusPlanned'),
              features: [1, 2, 3].map((n) => tl(`integrations.cards.${card.key}.f${n}`))
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
                  {tl('integrations.review')}
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
            {tl('capabilities.title')}
          </h2>
          <p className="text-base text-kp-text-secondary">
            {tl('capabilities.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{tl('capabilities.pricing.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {tl('capabilities.pricing.desc')}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{tl('capabilities.returns.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {tl('capabilities.returns.desc')}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-3">
            <h3 className="text-lg font-bold text-kp-text-primary">{tl('capabilities.erp.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {tl('capabilities.erp.desc')}
            </p>
          </div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-kp-lg p-6 shadow-kp-card space-y-4">
            <h3 className="text-lg font-bold text-kp-text-primary">{tl('capabilities.workflow.title')}</h3>
            <p className="text-sm text-kp-text-secondary leading-relaxed">
              {tl('capabilities.workflow.desc')}
            </p>
            <div className="space-y-1.5 font-mono text-[0.625rem] text-kp-text-tertiary">
              <p>✔ {tl('capabilities.workflow.rule1')}</p>
              <p>✔ {ti('common.workflowRule2')}</p>
              <p>✔ {tl('capabilities.workflow.rule3')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. HOW IT WORKS */}
      <section className="bg-kp-bg-secondary border-y border-kp-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-kp-text-primary tracking-tight">
              {tl('howItWorks.title')}
            </h2>
            <p className="text-base text-kp-text-secondary">
              {tl('howItWorks.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[1, 2, 3, 4].map((n) => ({
              step: `0${n}`,
              title: tl(`howItWorks.steps.s${n}.title`),
              desc: tl(`howItWorks.steps.s${n}.desc`)
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

      {/* 11. DASHBOARD OVERVIEW AREA (Dark Block) */}
      <section className="bg-slate-950 text-slate-100 py-20 relative border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12 relative z-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {tl('stats.title')}
            </h2>
            <p className="text-base text-slate-400">
              {tl('stats.desc')}
            </p>
          </div>

          {/* Premium Real-World Mockup Admin Dashboard */}
          <div className="bg-slate-900 border border-white/10 rounded-kp-lg p-6 max-w-4xl mx-auto shadow-2xl text-left space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ALQORA WMS // LIVE STATISTICS</span>
              <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold bg-green-500/10 text-green-500 border border-green-500/20">SYSTEM HEALTHY</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{tl('mockup.todaysOrders')}</p>
                <p className="text-xl font-bold text-white mt-1">2,840</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{tl('stats.pendingPicking')}</p>
                <p className="text-xl font-bold text-yellow-500 mt-1">114</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{tl('stats.criticalSku')}</p>
                <p className="text-xl font-bold text-red-500 mt-1">12</p>
              </div>
              <div className="bg-slate-950 p-4 border border-white/5 rounded">
                <p className="text-[0.625rem] text-slate-500 font-bold uppercase tracking-wider">{tl('stats.delayedShipments')}</p>
                <p className="text-xl font-bold text-white mt-1">0</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 border border-white/5 rounded space-y-2 col-span-2">
                <div className="flex justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
                  <span className="font-bold">{tl('stats.depotEfficiency')}</span>
                  <span>July 2026</span>
                </div>
                <div className="space-y-3 pt-1 text-[0.6875rem]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{tl('stats.pickingAccuracy')}</span>
                      <span className="font-bold text-green-500">99.9%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[99.9%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{tl('stats.packingSpeed')}</span>
                      <span className="font-bold text-kp-accent">94.8%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-kp-accent h-full w-[94.8%]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 border border-white/5 rounded space-y-3 text-xs">
                <div className="text-slate-400 font-bold border-b border-white/5 pb-2">{tl('stats.returnsTimes')}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{tl('stats.avgPickingTime')}</span>
                    <span className="font-bold text-white">4.2 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{tl('stats.returnRate')}</span>
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
              {tl('contact.title')}
            </h2>
            <p className="text-sm text-kp-text-secondary">
              {tl('contact.desc')}
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-6 rounded-kp-md text-center space-y-3 animate-scale-in">
              <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto" />
              <h4 className="text-lg font-bold">{tl('contact.successTitle')}</h4>
              <p className="text-sm text-kp-text-secondary max-w-md mx-auto">
                {tl('contact.successDesc')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-kp-text-secondary uppercase tracking-wider mb-2">
                    {tl('contact.nameLabel')}
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
                    {tl('contact.emailLabel')}
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
                    {tl('contact.phoneLabel')}
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
                    {tl('contact.volumeLabel')}
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
                    <option value="">{tl('contact.volumePlaceholder')}</option>
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
                  {tl('contact.channelsLabel')}
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
                    {tl('contact.kvkkLabel')}
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
                    {tl('contact.submitting')}
                  </>
                ) : (
                  tl('contact.submit')
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
            {tl('faq.title')}
          </h2>
          <p className="text-sm text-kp-text-secondary">
            {ti('common.faqDesc')}
          </p>
        </div>

        <div className="space-y-1">
          {sssItems.map((item, idx) => (
            <AccordionItem
              key={idx}
              question={item.q}
              answer={item.a}
              isOpen={openAccordionIdx === idx}
              onClick={() => setOpenAccordionIdx(openAccordionIdx === idx ? null : idx)}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
