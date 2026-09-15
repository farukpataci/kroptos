'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  LinkIcon,
  ArrowDownTrayIcon,
  ShieldExclamationIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import AccountingDocumentList from './components/AccountingDocumentList';
import AccountingMappingList from './components/AccountingMappingList';
import AccountingCompanyManager from './components/AccountingCompanyManager';
import DatevExportManager from './components/DatevExportManager';
import AccountingProblemQueue from './components/AccountingProblemQueue';
import AgentJobList from './components/AgentJobList';
import { AccountingIntegrationItem, AccountingCompanyItem } from './types';

export default function AccountingIntegrationsPage() {
  const t = useTranslations('accounting');
  const toast = useToast();
  const params = useParams();
  const tenantPublicId = params?.tenantPublicId as string;

  const [activeTab, setActiveTab] = useState<'documents' | 'mappings' | 'companies' | 'datev' | 'problems' | 'jobs'>('documents');
  const [integrations, setIntegrations] = useState<AccountingIntegrationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadIntegrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<AccountingIntegrationItem[]>('/accounting/integrations');
      setIntegrations(data || []);
    } catch (err: any) {
      toast.error(err.message || t('messages.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const allCompanies: AccountingCompanyItem[] = integrations.flatMap((i) =>
    (i.companies || []).map((c) => ({ ...c, provider: i.provider })),
  );
  const activeIntegration = integrations[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t('page.title')}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              MOCK_READY
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('page.subtitle')}
          </p>
        </div>

        <Link
          href={`/t/${tenantPublicId}/integrations`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-xs transition-all"
        >
          <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Entegrasyon Yönetimi
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex flex-wrap gap-4 sm:space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <DocumentTextIcon className="h-4 w-4" />
            {t('tabs.documents')}
          </button>

          <button
            onClick={() => setActiveTab('mappings')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'mappings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserGroupIcon className="h-4 w-4" />
            {t('tabs.mappings')}
          </button>

          <button
            onClick={() => setActiveTab('companies')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'companies'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BuildingOfficeIcon className="h-4 w-4" />
            {t('tabs.companies')}
          </button>

          <button
            onClick={() => setActiveTab('datev')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'datev'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            DATEV Dışa Aktarımı (EXTF)
          </button>

          <button
            onClick={() => setActiveTab('problems')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'problems'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldExclamationIcon className="h-4 w-4 text-amber-500" />
            Problem Kuyruğu
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'jobs'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CommandLineIcon className="h-4 w-4 text-blue-500" />
            Agent İşleri
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' && <AccountingDocumentList />}

      {activeTab === 'mappings' && (
        <AccountingMappingList companies={allCompanies} />
      )}

      {activeTab === 'companies' && activeIntegration && (
        <AccountingCompanyManager
          integrationId={activeIntegration.id}
          companies={activeIntegration.companies || []}
          onRefresh={loadIntegrations}
        />
      )}

      {activeTab === 'datev' && (
        <DatevExportManager companies={allCompanies} />
      )}

      {activeTab === 'problems' && (
        <AccountingProblemQueue />
      )}

      {activeTab === 'jobs' && (
        <AgentJobList />
      )}
    </div>
  );
}
