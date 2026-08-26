'use client';

import { useTranslations } from 'next-intl';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { SubPageShell, NotBuiltYet } from '../components/SubPageShell';

// TODO(backend): POST /api/orders/export — bu sayfanin arkasinda hicbir ucu yok.
// Kasitli olarak sahte satir uretilmiyor; dolu gorunen bir tablo calisan
// bir ozellikten ayirt edilemiyor.
export default function ExportPage() {
  const t = useTranslations('orderSubPages');

  return (
    <SubPageShell
      title={t('export.title')}
      subtitle={t('export.subtitle')}
      icon={ArrowDownTrayIcon}
    >
      <NotBuiltYet message={t('notBuiltYet')} />
    </SubPageShell>
  );
}
