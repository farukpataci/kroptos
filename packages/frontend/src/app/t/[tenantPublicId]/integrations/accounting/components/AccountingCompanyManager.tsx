'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon, BuildingOfficeIcon, TrashIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AccountingCompanyItem } from '../types';

interface AccountingCompanyManagerProps {
  integrationId: string;
  companies: AccountingCompanyItem[];
  onRefresh: () => void;
}

export default function AccountingCompanyManager({
  integrationId,
  companies,
  onRefresh,
}: AccountingCompanyManagerProps) {
  const t = useTranslations('accounting');
  const toast = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [externalCompanyId, setExternalCompanyId] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [isDefault, setIsDefault] = useState(false);
  const [invoiceSeries, setInvoiceSeries] = useState('');
  const [defaultRetailContactId, setDefaultRetailContactId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/accounting/integrations/${integrationId}/companies`, {
        externalCompanyId,
        name,
        currency,
        isDefault,
        invoiceSeries,
        defaultRetailContactId: defaultRetailContactId || undefined,
      });
      toast.success(t('companies.addSuccess'));
      setIsAdding(false);
      setExternalCompanyId('');
      setName('');
      setInvoiceSeries('');
      setDefaultRetailContactId('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || t('messages.operationFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm(t('companies.deleteConfirm'))) return;
    try {
      await api.delete(`/accounting/integrations/${integrationId}/companies/${companyId}`);
      toast.success(t('companies.deleteSuccess'));
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || t('messages.operationFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-kp-text-primary">
            {t('companies.title')}
          </h3>
          <p className="text-xs text-kp-text-muted">
            {t('companies.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 rounded-kp-md bg-kp-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-kp-primary-hover"
        >
          <PlusIcon className="h-4 w-4" />
          {t('companies.addBtn')}
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAddCompany}
          className="rounded-kp-lg border border-kp-border bg-kp-surface-card p-4 space-y-3"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                Firma ID (Harici) *
              </label>
              <input
                type="text"
                required
                value={externalCompanyId}
                onChange={(e) => setExternalCompanyId(e.target.value)}
                placeholder="Örn: 98765"
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                Firma / Şube Adı *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: İstanbul Merkez"
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                Fatura Serisi
              </label>
              <input
                type="text"
                value={invoiceSeries}
                onChange={(e) => setInvoiceSeries(e.target.value)}
                placeholder="Örn: KRP"
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                Para Birimi
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
              >
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-kp-text-secondary mb-1">
              {t('companies.retailContact')}
            </label>
            <input
              type="text"
              value={defaultRetailContactId}
              onChange={(e) => setDefaultRetailContactId(e.target.value)}
              placeholder="Örn: kb-retail-cari-01"
              className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-kp-text-muted">
              {t('companies.retailContactHint')}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-kp-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-kp-border text-kp-primary focus:ring-0"
              />
              {t('companies.setDefault')}
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-kp-md border border-kp-border px-3 py-1.5 text-xs text-kp-text-secondary hover:bg-kp-bg-hover"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-kp-md bg-kp-primary px-3 py-1.5 text-xs text-white hover:bg-kp-primary-hover disabled:opacity-50"
              >
                {isSubmitting ? t('actions.saving') : t('actions.save')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Company Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {companies.map((comp) => (
          <div
            key={comp.id}
            className="rounded-kp-lg border border-kp-border bg-kp-surface-card p-4 relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-kp-md bg-kp-primary/10 p-2 text-kp-primary">
                    <BuildingOfficeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-kp-text-primary">
                      {comp.name || comp.externalCompanyId}
                    </h4>
                    <p className="text-[11px] font-mono text-kp-text-muted">
                      ID: {comp.externalCompanyId}
                    </p>
                  </div>
                </div>

                {comp.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                    <CheckBadgeIcon className="h-3 w-3" />
                    {t('companies.default')}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-kp-text-secondary">
                <div>
                  <span className="text-kp-text-muted">{t('companies.currency')}:</span>{' '}
                  {comp.currency}
                </div>
                <div>
                  <span className="text-kp-text-muted">{t('companies.series')}:</span>{' '}
                  {comp.invoiceSeries || '-'}
                </div>
              </div>

              {comp.defaultRetailContactId && (
                <div className="mt-2 text-[11px] text-kp-text-secondary border-t border-kp-border/40 pt-1.5">
                  <span className="text-kp-text-muted">Perakende Cari:</span>{' '}
                  <span className="font-mono text-xs text-kp-text-primary">
                    {comp.defaultRetailContactId}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-kp-border/60 pt-2">
              <button
                onClick={() => handleDelete(comp.id)}
                className="rounded p-1 text-kp-text-muted hover:bg-red-500/10 hover:text-red-400"
                title={t('actions.delete')}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
