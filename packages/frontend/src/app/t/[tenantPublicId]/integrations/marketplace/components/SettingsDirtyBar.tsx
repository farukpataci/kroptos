'use client';

import { useTranslations } from 'next-intl';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export function SettingsDirtyBar({
  count,
  isSaving,
  onDiscard,
  onSave,
}: {
  count: number;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useTranslations('integrations.settings');

  return (
    <div className="flex items-center justify-between gap-3 border-t border-kp-border bg-kp-bg-primary/60 px-5 py-3 animate-fade-in-up">
      <span className="flex items-center gap-2 text-[0.6875rem] font-semibold text-kp-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-kp-warning" />
        {t('dirty.pending', { count })}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary disabled:opacity-50"
        >
          {t('actions.discard')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover disabled:opacity-50"
        >
          {isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
          {t('actions.save')}
        </button>
      </div>
    </div>
  );
}
