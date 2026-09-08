'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, UserGroupIcon, CubeIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  AccountingContactMappingItem,
  AccountingProductMappingItem,
  AccountingCompanyItem,
} from '../types';

interface AccountingMappingListProps {
  companies: AccountingCompanyItem[];
}

export default function AccountingMappingList({ companies }: AccountingMappingListProps) {
  const t = useTranslations('accounting');
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'contacts' | 'products'>('contacts');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    companies.find((c) => c.isDefault)?.id || companies[0]?.id || '',
  );

  const [contacts, setContacts] = useState<AccountingContactMappingItem[]>([]);
  const [products, setProducts] = useState<AccountingProductMappingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMappings = useCallback(async () => {
    if (!selectedCompanyId) return;
    setIsLoading(true);
    try {
      if (activeTab === 'contacts') {
        const res = await api.get<{ items: AccountingContactMappingItem[] }>(
          `/accounting/mappings/contacts/${selectedCompanyId}`,
        );
        setContacts(res.items || []);
      } else {
        const res = await api.get<{ items: AccountingProductMappingItem[] }>(
          `/accounting/mappings/products/${selectedCompanyId}`,
        );
        setProducts(res.items || []);
      }
    } catch (err: any) {
      toast.error(err.message || t('messages.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompanyId, activeTab, t]);

  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const isBizimHesap = selectedCompany?.provider === 'BIZIMHESAP';

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-kp-md border border-kp-border bg-kp-surface-card p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex items-center gap-2 rounded-kp-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'contacts'
                ? 'bg-kp-primary text-white'
                : 'text-kp-text-secondary hover:bg-kp-bg-hover'
            }`}
          >
            <UserGroupIcon className="h-4 w-4" />
            {t('mappings.tabContacts')}
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 rounded-kp-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'products'
                ? 'bg-kp-primary text-white'
                : 'text-kp-text-secondary hover:bg-kp-bg-hover'
            }`}
          >
            <CubeIcon className="h-4 w-4" />
            {t('mappings.tabProducts')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-kp-text-muted">{t('mappings.selectCompany')}:</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.externalCompanyId} {c.isDefault ? `(${t('companies.default')})` : ''}
              </option>
            ))}
          </select>

          <button
            onClick={fetchMappings}
            className="rounded-kp-md border border-kp-border p-1.5 text-kp-text-secondary hover:bg-kp-bg-hover"
            title={t('actions.refresh')}
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="overflow-hidden rounded-kp-lg border border-kp-border bg-kp-surface-card">
        {activeTab === 'contacts' ? (
          <table className="min-w-full divide-y divide-kp-border text-left text-xs">
            <thead className="bg-kp-bg-muted/50 text-kp-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('mappings.colName')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colKroptosKey')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colTaxNumber')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colExternalId')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border text-kp-text-primary">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-kp-text-muted">
                    {isLoading ? t('mappings.loading') : t('mappings.noContacts')}
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-kp-bg-hover/50">
                    <td className="px-4 py-3 font-medium">{c.displayName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-kp-text-secondary">
                      {c.kroptosKey}
                    </td>
                    <td className="px-4 py-3">{c.taxNumber || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-blue-400">
                      {c.externalContactId}
                    </td>
                    <td className="px-4 py-3">
                      {isBizimHesap ? (
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20">
                          {t('mappings.createdWithInvoice')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                          {t('mappings.matched')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : isBizimHesap ? (
          <div className="p-8 text-center text-xs text-kp-text-muted space-y-2">
            <p className="font-semibold text-kp-text-secondary">{t('mappings.bizimhesapNoProductSync')}</p>
            <p>{t('mappings.bizimhesapNoProductSyncDesc')}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-kp-border text-left text-xs">
            <thead className="bg-kp-bg-muted/50 text-kp-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('mappings.colSku')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colProductName')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colExternalProductId')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colExternalCode')}</th>
                <th className="px-4 py-3 font-semibold">{t('mappings.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border text-kp-text-primary">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-kp-text-muted">
                    {isLoading ? t('mappings.loading') : t('mappings.noProducts')}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-kp-bg-hover/50">
                    <td className="px-4 py-3 font-mono text-[11px] font-medium text-kp-text-primary">
                      {p.productSku}
                    </td>
                    <td className="px-4 py-3 text-kp-text-secondary">{p.externalName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-blue-400">
                      {p.externalProductId}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">{p.externalCode || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                        {t('mappings.matched')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
