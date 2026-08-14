'use client';

import { useTranslations } from 'next-intl';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import type { FieldProps } from './FieldShell';

export function InfoField({ field }: FieldProps<unknown>) {
  const t = useTranslations();

  return (
    <div
      className={`flex gap-2.5 rounded-kp-md border border-kp-info/30 bg-kp-info-muted/10 p-3.5 ${
        field.colSpan === 2 ? 'md:col-span-2' : ''
      }`}
    >
      <InformationCircleIcon className="h-4 w-4 shrink-0 text-kp-info" />
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold text-kp-text-primary">{t(field.labelKey)}</p>
        {field.helpKey && (
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-kp-text-tertiary">
            {t(field.helpKey)}
          </p>
        )}
      </div>
    </div>
  );
}
