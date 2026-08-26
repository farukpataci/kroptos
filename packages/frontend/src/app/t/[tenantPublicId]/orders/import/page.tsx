'use client';

import { useTranslations } from 'next-intl';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { SubPageShell, NotBuiltYet } from '../components/SubPageShell';

// TODO(backend): POST /api/orders/import — bu sayfanin arkasinda hicbir ucu yok.
// Kasitli olarak sahte satir uretilmiyor; dolu gorunen bir tablo calisan
// bir ozellikten ayirt edilemiyor.
export default function ImportPage() {
  const t = useTranslations('orderSubPages');

  return (
    <SubPageShell
      title={t('import.title')}
      subtitle={t('import.subtitle')}
      icon={ArrowUpTrayIcon}
    >
      <NotBuiltYet message={t('notBuiltYet')} />
    </SubPageShell>
  );
}
