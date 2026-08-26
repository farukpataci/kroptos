'use client';

import { useTranslations } from 'next-intl';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { SubPageShell, NotBuiltYet } from '../components/SubPageShell';

// TODO(backend): GET /api/orders/invoices — bu sayfanin arkasinda hicbir ucu yok.
// Kasitli olarak sahte satir uretilmiyor; dolu gorunen bir tablo calisan
// bir ozellikten ayirt edilemiyor.
export default function InvoicesPage() {
  const t = useTranslations('orderSubPages');

  return (
    <SubPageShell
      title={t('invoices.title')}
      subtitle={t('invoices.subtitle')}
      icon={DocumentTextIcon}
    >
      <NotBuiltYet message={t('notBuiltYet')} />
    </SubPageShell>
  );
}
