'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LockClosedIcon } from '@heroicons/react/24/outline';

/** Yetkisiz rotaya dogrudan URL ile gelindiginde: sessizce dashboard'a atmak yerine 403 bos durumu. */
export default function Forbidden({ permission }: { permission: string }) {
  const t = useTranslations('common.forbidden');
  const { tenantPublicId } = useParams<{ tenantPublicId: string }>();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-kp-lg bg-kp-danger/10">
          <LockClosedIcon className="h-7 w-7 text-kp-danger" />
        </div>
        <h2 className="text-xl font-bold text-kp-text-primary">{t('title')}</h2>
        <p className="text-sm text-kp-text-secondary">{t('desc')}</p>
        <p className="text-[0.6875rem] font-mono text-kp-text-tertiary">{permission}</p>
        <Link href={`/t/${tenantPublicId}/dashboard`} className="inline-block rounded-kp-md bg-kp-accent px-4 py-2 text-sm font-semibold text-white hover:bg-kp-accent-hover">
          {t('backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
