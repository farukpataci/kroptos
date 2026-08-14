'use client';

import { XMarkIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Product } from '../hooks/useProducts';

interface DeleteConfirmModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  error?: string | null;
}

export default function DeleteConfirmModal({
  product,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: DeleteConfirmModalProps) {
  const t = useTranslations('products.deleteModal');
  const tc = useTranslations('common');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-danger/10">
              <ExclamationTriangleIcon className="h-4 w-4 text-kp-danger" />
            </div>
            <h3 className="text-sm font-semibold text-kp-text-primary">{t('title')}</h3>
          </div>
          <button onClick={onClose} className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-kp-text-secondary">
            {t.rich('confirmText', {
              name: product.name,
              strong: (chunks) => <span className="font-semibold text-kp-text-primary">{chunks}</span>,
            })}
          </p>

          <div className="rounded-kp-md bg-kp-bg-primary/50 border border-kp-border p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-kp-text-tertiary">SKU</span>
              <span className="font-mono font-medium text-kp-text-primary">{product.sku}</span>
            </div>
            {product.barcode && (
              <div className="flex justify-between text-xs">
                <span className="text-kp-text-tertiary">{t('barcode')}</span>
                <span className="font-mono text-kp-text-secondary">{product.barcode}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-kp-text-tertiary">{t('stock')}</span>
              <span className="text-kp-text-secondary">{t('units', { count: product.stockQuantity })}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-kp-md bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[0.6875rem] text-amber-400">
              {t.rich('softDeleteNote', { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
          >
            {tc('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {isDeleting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
            {t('title')}
          </button>
        </div>
      </div>
    </div>
  );
}
