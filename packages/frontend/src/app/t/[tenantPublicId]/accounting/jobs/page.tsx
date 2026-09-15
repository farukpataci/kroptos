'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CommandLineIcon,
  ShieldExclamationIcon,
  DocumentTextIcon,
  LinkIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import AccountingProblemQueue from '../../integrations/accounting/components/AccountingProblemQueue';
import AgentJobList from '../../integrations/accounting/components/AgentJobList';
import AccountingDocumentList from '../../integrations/accounting/components/AccountingDocumentList';

export default function AccountingJobsPage() {
  const params = useParams();
  const tenantPublicId = params?.tenantPublicId as string;
  const [activeTab, setActiveTab] = useState<'problems' | 'jobs' | 'claims'>('problems');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Muhasebe İş ve Problem Kuyruğu
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <CommandLineIcon className="h-3.5 w-3.5" />
              Kuyruk Yönetimi
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Agent iş kuyruğu, operasyonel problem bildirimleri ve asılı fatura claim&apos;leri takibi.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/t/${tenantPublicId}/agents`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <ComputerDesktopIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Agent Yönetimi
          </Link>
          <Link
            href={`/t/${tenantPublicId}/integrations/accounting`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Muhasebe Entegrasyonları
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('problems')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'problems'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldExclamationIcon className="h-4 w-4" />
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
            <CommandLineIcon className="h-4 w-4" />
            Agent İş Kuyruğu
          </button>

          <button
            onClick={() => setActiveTab('claims')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors font-semibold ${
              activeTab === 'claims'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <DocumentTextIcon className="h-4 w-4" />
            Asılı Claim & Fatura Durumları
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      {activeTab === 'problems' && <AccountingProblemQueue />}
      {activeTab === 'jobs' && <AgentJobList />}
      {activeTab === 'claims' && <AccountingDocumentList />}
    </div>
  );
}
