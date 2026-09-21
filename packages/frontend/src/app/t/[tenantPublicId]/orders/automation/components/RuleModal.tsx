'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type {
  AutomationMeta,
  AutomationRule,
  RulePayload,
} from '../hooks/useOrderAutomation';

interface RuleModalProps {
  meta: AutomationMeta;
  /** Düzenlemede dolu, yeni kuralda null. */
  rule: AutomationRule | null;
  onClose: () => void;
  onSubmit: (payload: RulePayload) => Promise<void>;
}

/** Virgülle yazılan listeyi diziye çevirir; boş girdi alanı yok sayar. */
function parseList(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Çoklu seçim kutusu: durum kümeleri için. */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  optionLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  optionLabel: (value: string) => string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isOn = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(
                  isOn ? selected.filter((s) => s !== option) : [...selected, option],
                )
              }
              className={`rounded-kp-sm border px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors ${
                isOn
                  ? 'border-kp-accent bg-kp-accent/10 text-kp-accent'
                  : 'border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover'
              }`}
            >
              {optionLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RuleModal({ meta, rule, onClose, onSubmit }: RuleModalProps) {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');

  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [trigger, setTrigger] = useState(rule?.trigger ?? meta.triggers[0]);
  const [priority, setPriority] = useState(String(rule?.priority ?? 100));

  const c = rule?.conditions ?? {};
  const [source, setSource] = useState((c.source ?? []).join(', '));
  const [statusIn, setStatusIn] = useState<string[]>(c.statusIn ?? []);
  const [paymentStatusIn, setPaymentStatusIn] = useState<string[]>(c.paymentStatusIn ?? []);
  const [fulfillmentStatusIn, setFulfillmentStatusIn] = useState<string[]>(
    c.fulfillmentStatusIn ?? [],
  );
  const [minTotal, setMinTotal] = useState(c.minTotal !== undefined ? String(c.minTotal) : '');
  const [maxTotal, setMaxTotal] = useState(c.maxTotal !== undefined ? String(c.maxTotal) : '');
  const [currency, setCurrency] = useState(c.currency ?? '');
  const [cities, setCities] = useState((c.cities ?? []).join(', '));
  const [olderThanMinutes, setOlderThanMinutes] = useState(
    c.olderThanMinutes !== undefined ? String(c.olderThanMinutes) : '',
  );

  const [actionType, setActionType] = useState(rule?.action?.type ?? meta.actions[0]);
  const [actionValue, setActionValue] = useState(rule?.action?.value ?? '');
  const [actionNote, setActionNote] = useState(rule?.action?.note ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Seçilen aksiyonun hedef değer kümesi; yoksa değer alanı gösterilmez. */
  const valueOptions = useMemo(() => {
    switch (actionType) {
      case 'set_status':
        return meta.orderStatuses;
      case 'set_payment_status':
        return meta.paymentStatuses;
      case 'set_fulfillment_status':
        return meta.fulfillmentStatuses;
      default:
        return null;
    }
  }, [actionType, meta]);

  const needsWaitMinutes = trigger === 'order_pending_too_long';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    if (valueOptions && !actionValue) {
      setError(t('validation.actionValueRequired'));
      return;
    }
    if (actionType === 'add_note' && !actionNote.trim()) {
      setError(t('validation.noteRequired'));
      return;
    }
    if (needsWaitMinutes && !parseNumber(olderThanMinutes)) {
      setError(t('validation.waitRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        priority: parseNumber(priority) ?? 100,
        conditions: {
          source: parseList(source),
          statusIn: statusIn.length ? statusIn : undefined,
          paymentStatusIn: paymentStatusIn.length ? paymentStatusIn : undefined,
          fulfillmentStatusIn: fulfillmentStatusIn.length ? fulfillmentStatusIn : undefined,
          minTotal: parseNumber(minTotal),
          maxTotal: parseNumber(maxTotal),
          currency: currency.trim() || undefined,
          cities: parseList(cities),
          olderThanMinutes: needsWaitMinutes ? parseNumber(olderThanMinutes) : undefined,
        },
        action: {
          type: actionType,
          value: valueOptions ? actionValue : undefined,
          note: actionNote.trim() || undefined,
        },
      });
      onClose();
    } catch (err: any) {
      // Sunucunun doğrulama mesajı gösteriliyor: "koşul ve aksiyon aynı
      // durumu gösteriyor" gibi uyarıların kullanıcıya ulaşması gereken yer
      // burası.
      setError(err?.message || tc('unknownError'));
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-xs text-kp-text-primary transition-colors placeholder:text-kp-text-tertiary focus:border-kp-accent focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-kp-bg-secondary/80 backdrop-blur-sm p-4">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0 animate-fade-in">
        <div className="flex items-center justify-between border-b border-kp-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-kp-text-primary">
              {rule ? t('modal.editTitle') : t('modal.title')}
            </h2>
            <p className="mt-0.5 text-xs text-kp-text-tertiary">{t('modal.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                {t('modal.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('modal.nameHint')}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                {t('modal.description')}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                {t('modal.trigger')}
              </label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                {meta.triggers.map((option) => (
                  <option key={option} value={option}>
                    {t(`triggers.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                {t('modal.priority')}
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[0.6875rem] text-kp-text-tertiary">
                {t('modal.priorityHint')}
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-kp-md border border-kp-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-kp-text-tertiary">
              {t('modal.conditions')}
            </p>

            {needsWaitMinutes && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('modal.olderThanMinutes')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={olderThanMinutes}
                  onChange={(e) => setOlderThanMinutes(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <MultiSelect
              label={t('fields.status')}
              options={meta.orderStatuses}
              selected={statusIn}
              onChange={setStatusIn}
              optionLabel={(v) => t(`orderStatus.${v}`)}
            />

            <MultiSelect
              label={t('fields.paymentStatus')}
              options={meta.paymentStatuses}
              selected={paymentStatusIn}
              onChange={setPaymentStatusIn}
              optionLabel={(v) => t(`paymentStatus.${v}`)}
            />

            <MultiSelect
              label={t('fields.fulfillmentStatus')}
              options={meta.fulfillmentStatuses}
              selected={fulfillmentStatusIn}
              onChange={setFulfillmentStatusIn}
              optionLabel={(v) => t(`fulfillmentStatus.${v}`)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('fields.source')}
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="trendyol, hepsiburada"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('fields.city')}
                </label>
                <input
                  type="text"
                  value={cities}
                  onChange={(e) => setCities(e.target.value)}
                  placeholder="İstanbul, Ankara"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('fields.minTotal')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={minTotal}
                  onChange={(e) => setMinTotal(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('fields.maxTotal')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={maxTotal}
                  onChange={(e) => setMaxTotal(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('fields.currency')}
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="TRY"
                  className={inputClass}
                />
                <p className="mt-1 text-[0.6875rem] text-kp-text-tertiary">
                  {t('modal.currencyHint')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-kp-md border border-kp-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-kp-text-tertiary">
              {t('modal.action')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {t('modal.actionType')}
                </label>
                <select
                  value={actionType}
                  onChange={(e) => {
                    setActionType(e.target.value);
                    setActionValue('');
                  }}
                  className={`${inputClass} cursor-pointer`}
                >
                  {meta.actions.map((option) => (
                    <option key={option} value={option}>
                      {t(`actionTypes.${option}`)}
                    </option>
                  ))}
                </select>
              </div>

              {valueOptions && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                    {t('modal.actionValue')}
                  </label>
                  <select
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">{t('modal.selectValue')}</option>
                    {valueOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-kp-text-secondary">
                  {actionType === 'add_note' ? t('modal.noteRequired') : t('modal.note')}
                </label>
                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <p className="rounded-kp-md border border-kp-info/30 bg-kp-info-muted px-3 py-2 text-[0.6875rem] text-kp-text-secondary">
            {t('modal.effectiveFromNote')}
          </p>

          {error && (
            <div className="rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3 py-2 text-xs text-kp-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-kp-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:bg-kp-bg-hover"
            >
              {tc('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isSaving ? tc('loading') : tc('actions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
