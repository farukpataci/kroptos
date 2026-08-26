'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Cog6ToothIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { SubPageShell, StoreRequired } from '@/components/layout/SubPageShell';

const TABS = ['general', 'stock', 'pricing', 'media', 'categoryMapping'] as const;
type Tab = (typeof TABS)[number];

const fieldClass =
  'w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none';

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-kp-text-secondary">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.6875rem] text-kp-text-tertiary">{hint}</p>}
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2.5"
    >
      <span className="text-xs text-kp-text-secondary">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-kp-border accent-kp-accent"
      />
    </label>
  );
}

// TODO(backend): GET/PATCH /api/products/settings — ürün ayarı için uç yok.
// Alanlar yerel state'te durur, Kaydet devre dışı: kaydedilmiş gibi görünüp
// yenilemede kaybolan bir form, hiç olmayan formdan daha kötüdür.
export default function ProductSettingsPage() {
  const t = useTranslations('productSettings');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();
  const params = useParams();
  const tenantPublicId = (params?.tenantPublicId as string) || '';

  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState({
    currency: 'TRY',
    taxRate: '20',
    skuTemplate: '{CATEGORY}-{SEQ}',
    nameMaxLength: '150',
    reorderLevel: '10',
    allowNegative: false,
    autoReserve: true,
    outOfStockBehaviour: 'unpublish',
    margin: '25',
    rounding: 'nearest_099',
    commission: '15',
    maxImages: '10',
    requirePrimaryImage: true,
    minResolution: '800',
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (!tenantContext.storeId) {
    return (
      <StoreRequired
        icon={Cog6ToothIcon}
        title={t('storeRequired.title')}
        description={t('storeRequired.desc')}
      />
    );
  }

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={Cog6ToothIcon}
      actions={
        <button
          type="button"
          disabled
          title={t('notWired')}
          className="cursor-not-allowed rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white opacity-50"
        >
          {tc('actions.save')}
        </button>
      }
    >
      <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-1 border-b border-kp-border">
        {TABS.map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              tab === value
                ? 'border-kp-accent text-kp-accent'
                : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
            }`}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-5">
        {tab === 'general' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-currency" label={t('general.currency')}>
              <select
                id="s-currency"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className={fieldClass}
              >
                {['TRY', 'USD', 'EUR', 'GBP'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="s-tax" label={t('general.taxRate')}>
              <input
                id="s-tax"
                type="number"
                value={form.taxRate}
                onChange={(e) => set('taxRate', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="s-sku" label={t('general.skuTemplate')} hint={t('general.skuTemplateHint')}>
              <input
                id="s-sku"
                type="text"
                value={form.skuTemplate}
                onChange={(e) => set('skuTemplate', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="s-namelen" label={t('general.nameMaxLength')}>
              <input
                id="s-namelen"
                type="number"
                value={form.nameMaxLength}
                onChange={(e) => set('nameMaxLength', e.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        )}

        {tab === 'stock' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-reorder" label={t('stock.reorderLevel')} hint={t('stock.reorderLevelHint')}>
              <input
                id="s-reorder"
                type="number"
                value={form.reorderLevel}
                onChange={(e) => set('reorderLevel', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="s-oos" label={t('stock.outOfStockBehaviour')}>
              <select
                id="s-oos"
                value={form.outOfStockBehaviour}
                onChange={(e) => set('outOfStockBehaviour', e.target.value)}
                className={fieldClass}
              >
                <option value="unpublish">{t('stock.behaviourUnpublish')}</option>
                <option value="zero_stock">{t('stock.behaviourZeroStock')}</option>
              </select>
            </Field>
            <Toggle
              id="s-negative"
              label={t('stock.allowNegative')}
              checked={form.allowNegative}
              onChange={(v) => set('allowNegative', v)}
            />
            <Toggle
              id="s-reserve"
              label={t('stock.autoReserve')}
              checked={form.autoReserve}
              onChange={(v) => set('autoReserve', v)}
            />
          </div>
        )}

        {tab === 'pricing' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="s-margin" label={t('pricing.margin')}>
              <input
                id="s-margin"
                type="number"
                value={form.margin}
                onChange={(e) => set('margin', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="s-round" label={t('pricing.rounding')}>
              <select
                id="s-round"
                value={form.rounding}
                onChange={(e) => set('rounding', e.target.value)}
                className={fieldClass}
              >
                <option value="none">{t('pricing.roundNone')}</option>
                <option value="nearest_099">{t('pricing.round099')}</option>
                <option value="nearest_int">{t('pricing.roundInt')}</option>
              </select>
            </Field>
            <Field id="s-commission" label={t('pricing.commission')}>
              <input
                id="s-commission"
                type="number"
                value={form.commission}
                onChange={(e) => set('commission', e.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        )}

        {tab === 'media' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-maximg" label={t('media.maxImages')}>
              <input
                id="s-maximg"
                type="number"
                value={form.maxImages}
                onChange={(e) => set('maxImages', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="s-minres" label={t('media.minResolution')} hint={t('media.minResolutionHint')}>
              <input
                id="s-minres"
                type="number"
                value={form.minResolution}
                onChange={(e) => set('minResolution', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Toggle
              id="s-primary"
              label={t('media.requirePrimaryImage')}
              checked={form.requirePrimaryImage}
              onChange={(v) => set('requirePrimaryImage', v)}
            />
          </div>
        )}

        {tab === 'categoryMapping' && (
          // Link, not a copy: the mapping screen already exists under
          // /integrations/marketplace and a second one would drift from it.
          <div className="flex flex-col items-start gap-3">
            <p className="max-w-lg text-xs text-kp-text-tertiary">{t('categoryMapping.desc')}</p>
            <Link
              href={`/t/${tenantPublicId}/integrations/marketplace`}
              className="flex items-center gap-2 rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover hover:text-kp-accent"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              {t('categoryMapping.open')}
            </Link>
          </div>
        )}

        <p className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-tertiary">
          {t('notWired')}
        </p>
      </div>
    </SubPageShell>
  );
}
