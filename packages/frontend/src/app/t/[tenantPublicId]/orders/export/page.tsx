'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowDownTrayIcon,
  ClockIcon,
  CalendarDaysIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SubPageShell } from '@/components/layout/SubPageShell';
import { useOrderExport } from './hooks/useOrderExport';
import { NewExportTab } from './components/NewExportTab';
import { ExportHistoryTab } from './components/ExportHistoryTab';
import { ExportSchedulesTab } from './components/ExportSchedulesTab';

export default function ExportPage() {
  const t = useTranslations('orderSubPages');
  const exportHook = useOrderExport();
  const { activeTab, setActiveTab, presets } = exportHook;

  return (
    <SubPageShell
      title={t('export.title')}
      subtitle={t('export.subtitle')}
      icon={ArrowDownTrayIcon}
    >
      {/* 3-TAB NAVIGATION BAR */}
      <div className="mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('new')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'new'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <SparklesIcon className="h-4 w-4" />
          Yeni Dışa Aktarma
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
          onClick={() => setActiveTab('schedules')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === 'schedules'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CalendarDaysIcon className="h-4 w-4" />
          Zamanlanmış
        </button>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'new' && <NewExportTab exportHook={exportHook} />}
      {activeTab === 'history' && <ExportHistoryTab />}
      {activeTab === 'schedules' && <ExportSchedulesTab presets={presets} />}
    </SubPageShell>
  );
}
