'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  PlusIcon,
  ArrowPathIcon,
  BoltIcon,
  Cog6ToothIcon,
  TrashIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import AddAccountingModal from './components/AddAccountingModal';
import AccountingDocumentList from './components/AccountingDocumentList';
import AccountingMappingList from './components/AccountingMappingList';
import AccountingCompanyManager from './components/AccountingCompanyManager';
import { AccountingIntegrationItem, AccountingCompanyItem } from './types';

export default function AccountingIntegrationsPage() {
  const t = useTranslations('accounting');
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'integrations' | 'documents' | 'mappings' | 'companies'>(
    'integrations',
  );

  const [integrations, setIntegrations] = useState<AccountingIntegrationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<AccountingIntegrationItem | null>(null);

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
  }, [t]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const handleTestConnection = async (integration: AccountingIntegrationItem) => {
    setTestingId(integration.id);
    try {
      const res = await api.post<{ success: boolean; message: string; companyName?: string }>(
        `/accounting/integrations/${integration.id}/test-connection`,
      );
      if (res.success) {
        toast.success(res.message || t('messages.testSuccess'));
      } else {
        toast.error(res.message || t('messages.testFailed'));
      }
      loadIntegrations();
    } catch (err: any) {
      toast.error(err.message || t('messages.testFailed'));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('messages.deleteConfirm'))) return;
    try {
      await api.delete(`/accounting/integrations/${id}`);
      toast.success(t('messages.deleteSuccess'));
      loadIntegrations();
    } catch (err: any) {
      toast.error(err.message || t('messages.operationFailed'));
    }
  };

  const allCompanies: AccountingCompanyItem[] = integrations.flatMap((i) => i.companies || []);
  const activeIntegration = integrations[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-kp-text-primary">
              {t('page.title')}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              MOCK_READY
            </span>
          </div>
          <p className="mt-1 text-xs text-kp-text-muted">
            {t('page.subtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            setEditingIntegration(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-kp-md bg-kp-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-kp-primary-hover"
        >
          <PlusIcon className="h-4 w-4" />
          {t('actions.addIntegration')}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-kp-border">
        <nav className="-mb-px flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors ${
              activeTab === 'integrations'
                ? 'border-kp-primary text-kp-primary'
                : 'border-transparent text-kp-text-secondary hover:border-kp-border hover:text-kp-text-primary'
            }`}
          >
            <LinkIcon className="h-4 w-4" />
            {t('tabs.integrations')} ({integrations.length})
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors ${
              activeTab === 'documents'
                ? 'border-kp-primary text-kp-primary'
                : 'border-transparent text-kp-text-secondary hover:border-kp-border hover:text-kp-text-primary'
            }`}
          >
            <DocumentTextIcon className="h-4 w-4" />
            {t('tabs.documents')}
          </button>

          <button
            onClick={() => setActiveTab('mappings')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors ${
              activeTab === 'mappings'
                ? 'border-kp-primary text-kp-primary'
                : 'border-transparent text-kp-text-secondary hover:border-kp-border hover:text-kp-text-primary'
            }`}
          >
            <UserGroupIcon className="h-4 w-4" />
            {t('tabs.mappings')}
          </button>

          <button
            onClick={() => setActiveTab('companies')}
            className={`flex items-center gap-2 border-b-2 py-3 transition-colors ${
              activeTab === 'companies'
                ? 'border-kp-primary text-kp-primary'
                : 'border-transparent text-kp-text-secondary hover:border-kp-border hover:text-kp-text-primary'
            }`}
          >
            <BuildingOfficeIcon className="h-4 w-4" />
            {t('tabs.companies')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-kp-lg border border-kp-border bg-kp-surface-card p-8 text-center text-xs text-kp-text-muted">
              {t('messages.loading')}
            </div>
          ) : integrations.length === 0 ? (
            <div className="rounded-kp-lg border border-dashed border-kp-border bg-kp-surface-card p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                P
              </div>
              <h3 className="mt-3 text-sm font-semibold text-kp-text-primary">
                {t('empty.title')}
              </h3>
              <p className="mt-1 text-xs text-kp-text-muted">
                {t('empty.subtitle')}
              </p>
              <button
                onClick={() => {
                  setEditingIntegration(null);
                  setIsAddModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-kp-md bg-kp-primary px-4 py-2 text-xs font-semibold text-white hover:bg-kp-primary-hover"
              >
                <PlusIcon className="h-4 w-4" />
                {t('actions.addIntegration')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-kp-lg border border-kp-border bg-kp-surface-card p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-kp-md bg-blue-500/10 text-blue-500 font-bold text-xl">
                        P
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-kp-text-primary">
                            {item.name}
                          </h3>
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                            {item.provider}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-kp-text-muted mt-0.5">
                          Scope: {item.scopeKey}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          item.status === 'connected'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : item.status === 'error'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
                        {item.environment} ({item.readiness})
                      </span>
                    </div>
                  </div>

                  <div className="rounded-kp-md bg-kp-bg-muted/40 p-3 text-[11px] text-kp-text-secondary space-y-1">
                    <div className="flex justify-between">
                      <span className="text-kp-text-muted">{t('fields.lastVerified')}:</span>
                      <span>
                        {item.lastVerifiedAt
                          ? new Date(item.lastVerifiedAt).toLocaleString('tr-TR')
                          : '-'}
                      </span>
                    </div>
                    {item.lastErrorMessage && (
                      <div className="text-red-400 text-[11px] pt-1">
                        {item.lastErrorMessage}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-kp-border pt-3">
                    <button
                      onClick={() => handleTestConnection(item)}
                      disabled={testingId === item.id}
                      className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:bg-kp-bg-hover disabled:opacity-40"
                    >
                      <BoltIcon className={`h-3.5 w-3.5 ${testingId === item.id ? 'animate-spin' : ''}`} />
                      {testingId === item.id ? t('actions.testing') : t('actions.testConnection')}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingIntegration(item);
                          setIsAddModalOpen(true);
                        }}
                        className="rounded-kp-md border border-kp-border p-1.5 text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary"
                        title={t('actions.edit')}
                      >
                        <Cog6ToothIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-kp-md border border-kp-border p-1.5 text-kp-text-secondary hover:bg-red-500/10 hover:text-red-400"
                        title={t('actions.delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Add / Edit Modal */}
      <AddAccountingModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingIntegration(null);
        }}
        onSuccess={loadIntegrations}
        editingIntegration={editingIntegration}
      />
    </div>
  );
}
