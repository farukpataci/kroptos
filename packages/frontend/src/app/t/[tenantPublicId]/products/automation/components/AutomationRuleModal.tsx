'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BoltIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

/** Product/stock triggers only. Order-side automation lives under /orders/automation. */
export const TRIGGERS = ['stock_below', 'price_changed', 'product_created', 'marketplace_stock_diff'] as const;
export const CONDITION_FIELDS = ['category', 'brand', 'warehouse', 'price_range'] as const;
export const ACTIONS = [
  'unpublish_marketplace',
  'update_price',
  'add_tag',
  'send_notification',
  'create_purchase_request',
] as const;

interface ConditionRow {
  id: number;
  field: string;
  value: string;
}

interface AutomationRuleModalProps {
  onClose: () => void;
}

export default function AutomationRuleModal({ onClose }: AutomationRuleModalProps) {
  const t = useTranslations('productAutomation');
  const tc = useTranslations('common');

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<string>(TRIGGERS[0]);
  const [action, setAction] = useState<string>(ACTIONS[0]);
  const [conditions, setConditions] = useState<ConditionRow[]>([
    { id: 1, field: CONDITION_FIELDS[0], value: '' },
  ]);

  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      { id: (prev[prev.length - 1]?.id ?? 0) + 1, field: CONDITION_FIELDS[0], value: '' },
    ]);

  const removeCondition = (id: number) =>
    setConditions((prev) => (prev.length === 1 ? prev : prev.filter((c) => c.id !== id)));

  const selectClass =
    'w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-scale-in">
        <div className="flex items-center gap-2.5 border-b border-kp-border px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10">
            <BoltIcon className="h-4 w-4 text-kp-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-kp-text-primary">{t('modal.title')}</h2>
            <p className="text-xs text-kp-text-tertiary">{t('modal.subtitle')}</p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="rule-name" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('modal.name')}
            </label>
            <input
              id="rule-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('modal.nameHint')}
              className={selectClass}
            />
          </div>

          <div>
            <label htmlFor="rule-trigger" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('modal.trigger')}
            </label>
            <select
              id="rule-trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className={selectClass}
            >
              {TRIGGERS.map((v) => (
                <option key={v} value={v}>
                  {t(`triggers.${v}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-kp-text-secondary">
                {t('modal.conditions')}
              </span>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-1 text-xs font-semibold text-kp-accent hover:underline"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {t('modal.addCondition')}
              </button>
            </div>
            <div className="space-y-2">
              {conditions.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <select
                    value={c.field}
                    aria-label={t('modal.conditionField')}
                    onChange={(e) =>
                      setConditions((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, field: e.target.value } : x)),
                      )
                    }
                    className={`${selectClass} max-w-[40%]`}
                  >
                    {CONDITION_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {t(`conditionFields.${f}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={c.value}
                    aria-label={t('modal.conditionValue')}
                    placeholder={t('modal.conditionValue')}
                    onChange={(e) =>
                      setConditions((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    className={selectClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(c.id)}
                    disabled={conditions.length === 1}
                    aria-label={t('modal.removeCondition')}
                    className="rounded-kp-md border border-kp-border p-2 text-kp-text-tertiary transition-all hover:text-kp-danger disabled:opacity-30"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="rule-action" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('modal.action')}
            </label>
            <select
              id="rule-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={selectClass}
            >
              {ACTIONS.map((v) => (
                <option key={v} value={v}>
                  {t(`actionsList.${v}`)}
                </option>
              ))}
            </select>
          </div>

          <p className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-tertiary">
            {t('modal.notWired')}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-kp-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
          >
            {tc('actions.cancel')}
          </button>
          {/* No endpoint to save to. Enabled, it would silently drop the rule. */}
          <button
            type="button"
            disabled
            title={t('modal.notWired')}
            className="cursor-not-allowed rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white opacity-50"
          >
            {tc('actions.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
