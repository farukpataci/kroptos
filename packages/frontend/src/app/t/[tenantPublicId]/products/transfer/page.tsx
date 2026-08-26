'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { SubPageShell, StoreRequired } from '@/components/layout/SubPageShell';
import ImportWizard from './components/ImportWizard';
import ExportPanel from './components/ExportPanel';

const TABS = ['import', 'export'] as const;
type Tab = (typeof TABS)[number];

// TODO(backend): /api/products/import|export — hiçbiri yok. Sihirbaz ve dışa
// aktarma formu görünür ama gönderim butonları devre dışı; sahte bir dosya
// indirtmek veya "içe aktarıldı" demek, olmayan bir işi olmuş gibi gösterirdi.
export default function ProductTransferPage() {
  const t = useTranslations('productTransfer');
  const { tenantContext } = useAuth();

  const [tab, setTab] = useState<Tab>('import');

  if (!tenantContext.storeId) {
    return (
      <StoreRequired
        icon={ArrowsRightLeftIcon}
        title={t('storeRequired.title')}
        description={t('storeRequired.desc')}
      />
    );
  }

  return (
    <SubPageShell title={t('title')} subtitle={t('subtitle')} icon={ArrowsRightLeftIcon}>
      <div
        role="tablist"
        aria-label={t('title')}
        className="flex gap-1 border-b border-kp-border"
      >
        {TABS.map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              tab === value
                ? 'border-kp-accent text-kp-accent'
                : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
            }`}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      {tab === 'import' ? <ImportWizard /> : <ExportPanel />}
    </SubPageShell>
  );
}
