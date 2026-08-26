'use client';

import { useTranslations } from 'next-intl';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { SubPageShell, NotBuiltYet } from '../components/SubPageShell';

// TODO(backend): kendi ucu yok — bu sayfanin arkasinda hicbir ucu yok.
// Kasitli olarak sahte satir uretilmiyor; dolu gorunen bir tablo calisan
// bir ozellikten ayirt edilemiyor.
export default function SettingsPage() {
  const t = useTranslations('orderSubPages');

  return (
    <SubPageShell
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      icon={Cog6ToothIcon}
    >
      <NotBuiltYet message={t('notBuiltYet')} />
    </SubPageShell>
  );
}
