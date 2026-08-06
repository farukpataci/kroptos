'use client';

import { useTranslations } from 'next-intl';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * The list row's configuration state. An unconfigured integration cannot sync,
 * so this is the only cue the user gets before the sync button is disabled.
 */
export function SettingsCompletenessBadge({
  isConfigured,
  missingCount,
}: {
  isConfigured: boolean;
  missingCount: number;
}) {
  const t = useTranslations('integrations.settings');

  if (isConfigured) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-600">
        <CheckCircleIcon className="h-3 w-3" />
        {t('badge.configured')}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full border border-kp-warning/30 bg-kp-warning-muted/20 px-2 py-0.5 text-[0.625rem] font-bold text-kp-warning">
      <ExclamationTriangleIcon className="h-3 w-3" />
      {missingCount > 0 ? t('badge.missingFields', { count: missingCount }) : t('badge.pending')}
    </span>
  );
}
