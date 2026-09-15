'use client';

import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isBusy: boolean;
  error?: string | null;
}

/** products/DeleteConfirmModal ile ayni gorsel dil; urune bagli degil, genel. */
export default function DeleteConfirmModal({ title, children, confirmLabel, onClose, onConfirm, isBusy, error }: Props) {
  const tc = useTranslations('common');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-danger/10">
              <ExclamationTriangleIcon className="h-4 w-4 text-kp-danger" />
            </div>
            <h3 className="text-sm font-semibold text-kp-text-primary">{title}</h3>
          </div>
          <button onClick={onClose} className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-kp-text-secondary">
          {children}
          {error && (
            <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
          <button type="button" onClick={onClose} disabled={isBusy} className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50">
            {tc('actions.cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={isBusy} className="flex items-center gap-2 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50">
            {isBusy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel ?? tc('actions.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
