'use client';

import { useTranslations } from 'next-intl';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { SubPageShell, NotBuiltYet } from '@/components/layout/SubPageShell';

// TODO(backend): GET /api/orders/templates — bu sayfanin arkasinda hicbir ucu yok.
// Kasitli olarak sahte satir uretilmiyor; dolu gorunen bir tablo calisan
// bir ozellikten ayirt edilemiyor.
export default function TemplatesPage() {
  const t = useTranslations('orderSubPages');

  return (
    <SubPageShell
      title={t('templates.title')}
      subtitle={t('templates.subtitle')}
      icon={EnvelopeIcon}
    >
      <NotBuiltYet message={t('notBuiltYet')} />
    </SubPageShell>
  );
}
