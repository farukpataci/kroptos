'use client';

import { useTranslations } from 'next-intl';
import { BoltIcon } from '@heroicons/react/24/outline';
import { SubPageShell, NotBuiltYet } from '../components/SubPageShell';

// TODO(backend): GET /api/orders/automation-rules — bu sayfanin arkasinda hicbir ucu yok.
// Kasitli olarak sahte satir uretilmiyor; dolu gorunen bir tablo calisan
// bir ozellikten ayirt edilemiyor.
export default function AutomationPage() {
  const t = useTranslations('orderSubPages');

  return (
    <SubPageShell
      title={t('automation.title')}
      subtitle={t('automation.subtitle')}
      icon={BoltIcon}
    >
      <NotBuiltYet message={t('notBuiltYet')} />
    </SubPageShell>
  );
}
