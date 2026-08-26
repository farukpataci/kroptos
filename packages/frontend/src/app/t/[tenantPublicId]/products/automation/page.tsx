'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BoltIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { SubPageShell, StoreRequired } from '@/components/layout/SubPageShell';
import AutomationRuleModal from './components/AutomationRuleModal';

// TODO(backend): GET/POST /api/products/automation-rules — henüz yok.
// Kural listesi kasıtlı olarak BOŞ geliyor; uydurma kartlar basmak, çalışan bir
// özellikten ayırt edilemeyen bir ekran üretir ve birileri ona karşı iş yapar.
export default function ProductAutomationPage() {
  const t = useTranslations('productAutomation');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!tenantContext.storeId) {
    return (
      <StoreRequired
        icon={BoltIcon}
        title={t('storeRequired.title')}
        description={t('storeRequired.desc')}
      />
    );
  }

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={BoltIcon}
      actions={
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-kp-accent-hover"
        >
          <PlusIcon className="h-4 w-4" />
          {t('actions.newRule')}
        </button>
      }
    >
      <div className="card flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-kp-lg bg-kp-bg-hover">
          <BoltIcon className="h-6 w-6 text-kp-text-tertiary" />
        </div>
        <p className="text-sm font-semibold text-kp-text-primary">{t('empty.title')}</p>
        <p className="max-w-md text-xs text-kp-text-tertiary">{t('empty.desc')}</p>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="mt-1 rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover"
        >
          {t('actions.newRule')}
        </button>
      </div>

      <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-4 py-3">
        <p className="text-xs text-kp-text-tertiary">
          {t('scopeNote')} <span className="text-kp-text-secondary">{tc('actions.view')}: /orders/automation</span>
        </p>
      </div>

      {isModalOpen && <AutomationRuleModal onClose={() => setIsModalOpen(false)} />}
    </SubPageShell>
  );
}
