'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowUpTrayIcon,
  ClockIcon,
  BookmarkSquareIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SubPageShell } from '@/components/layout/SubPageShell';
import { useOrderImport } from './hooks/useOrderImport';
import { NewImportWizard } from './components/NewImportWizard';
import { ImportHistoryTab } from './components/ImportHistoryTab';
import { ImportMappingsTab } from './components/ImportMappingsTab';

export default function ImportPage() {
  const t = useTranslations('orderSubPages');
  const importHook = useOrderImport();
  const { activeTab, setActiveTab } = importHook;

  return (
    <SubPageShell
      title={t('import.title')}
      subtitle={t('import.subtitle')}
      icon={ArrowUpTrayIcon}
    >
      {/* 3-TAB NAVIGATION BAR */}
      <div className="mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('wizard')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'wizard'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <SparklesIcon className="h-4 w-4" />
          Yeni İçe Aktarma
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ClockIcon className="h-4 w-4" />
          Geçmiş
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'templates'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookmarkSquareIcon className="h-4 w-4" />
          Eşleştirme Şablonları
        </button>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'wizard' && <NewImportWizard importHook={importHook} />}
      {activeTab === 'history' && <ImportHistoryTab />}
      {activeTab === 'templates' && <ImportMappingsTab />}
    </SubPageShell>
  );
}
