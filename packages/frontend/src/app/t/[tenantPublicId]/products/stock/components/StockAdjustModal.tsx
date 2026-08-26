'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdjustmentsHorizontalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { StockRow } from '../hooks/useProductStock';

/**
 * The backend's AdjustmentType enum, verbatim. Anything else fails class-validator
 * with a 400, so the select offers exactly these and nothing is invented here.
 */
const ADJUSTMENT_TYPES = ['Inbound', 'Outbound', 'Transfer', 'Damage', 'Lost', 'Cycle Count'] as const;

interface StockAdjustModalProps {
  row: StockRow;
  onClose: () => void;
  onSubmit: (payload: {
    productId: string;
    type: string;
    quantity: number;
    reason?: string;
  }) => Promise<void>;
}

export default function StockAdjustModal({ row, onClose, onSubmit }: StockAdjustModalProps) {
  const t = useTranslations('productStock');
  const tc = useTranslations('common');

  const [type, setType] = useState<string>('Inbound');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedQuantity = Number(quantity);
  const isValid = quantity.trim() !== '' && Number.isFinite(parsedQuantity) && parsedQuantity !== 0;

  const handleSubmit = async () => {
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        productId: row.productId,
        type,
        quantity: parsedQuantity,
        // One field upstream, two in the form: the operator's note is worth
        // keeping, and appending it beats dropping it on the floor.
        reason: [reason.trim(), note.trim()].filter(Boolean).join(' — ') || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || t('adjust.failed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-kp-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10">
            <AdjustmentsHorizontalIcon className="h-4 w-4 text-kp-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-kp-text-primary">{t('adjust.title')}</h2>
            <p className="truncate text-xs text-kp-text-tertiary">
              {row.name} · <span className="font-mono">{row.sku}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-3 gap-2 rounded-kp-md border border-kp-border bg-kp-bg-primary/40 p-3 text-center">
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-kp-text-tertiary">
                {t('columns.total')}
              </p>
              <p className="text-sm font-semibold text-kp-text-primary">{row.totalQty}</p>
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-kp-text-tertiary">
                {t('columns.reserved')}
              </p>
              <p className="text-sm font-semibold text-kp-text-primary">{row.reservedQty}</p>
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-kp-text-tertiary">
                {t('columns.available')}
              </p>
              <p className="text-sm font-semibold text-kp-text-primary">{row.availableQty}</p>
            </div>
          </div>

          <div>
            <label htmlFor="adjust-type" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('adjust.type')}
            </label>
            <select
              id="adjust-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
            >
              {ADJUSTMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`adjust.types.${value.replace(' ', '_')}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="adjust-qty" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('adjust.quantity')}
            </label>
            <input
              id="adjust-qty"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t('adjust.quantityHint')}
              className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adjust-reason" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('adjust.reason')}
            </label>
            <input
              id="adjust-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('adjust.reasonHint')}
              className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adjust-note" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('adjust.note')}
            </label>
            <textarea
              id="adjust-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3 py-2 text-xs text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-kp-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary disabled:opacity-50"
          >
            {tc('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
            className="rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-kp-accent-hover disabled:opacity-50"
          >
            {isSaving ? tc('saving') : t('adjust.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
