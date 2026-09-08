'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AccountingDocumentItem } from '../types';

export default function AccountingDocumentList() {
  const t = useTranslations('accounting');
  const toast = useToast();
  const [documents, setDocuments] = useState<AccountingDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedRawDoc, setSelectedRawDoc] = useState<AccountingDocumentItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;

      const res = await api.get<{ items: AccountingDocumentItem[]; total: number }>(
        '/accounting/documents',
        { params },
      );
      setDocuments(res.items || []);
    } catch (err: any) {
      toast.error(err.message || t('messages.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, t]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleCancelClaim = async (doc: AccountingDocumentItem) => {
    if (!confirm(t('documents.cancelConfirm'))) return;
    setCancellingId(doc.id);
    try {
      await api.post(`/accounting/documents/${doc.id}/cancel-claim`);
      toast.success(t('documents.cancelSuccess'));
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || t('messages.operationFailed'));
    } finally {
      setCancellingId(null);
    }
  };

  const renderStatus = (status: string, errMsg?: string) => {
    switch (status) {
      case 'created':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            {t('status.created')}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20 animate-pulse">
            <ClockIcon className="h-3.5 w-3.5 animate-spin" />
            {t('status.pending')}
          </span>
        );
      case 'failed':
        return (
          <span
            title={errMsg}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20 cursor-help"
          >
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            {t('status.failed')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-400 border border-zinc-500/20">
            <XCircleIcon className="h-3.5 w-3.5" />
            {t('status.cancelled')}
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex items-center justify-between gap-3 bg-kp-surface-card p-3 rounded-kp-md border border-kp-border">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
          >
            <option value="">{t('filters.allStatuses')}</option>
            <option value="created">{t('status.created')}</option>
            <option value="pending">{t('status.pending')}</option>
            <option value="failed">{t('status.failed')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-1.5 text-xs text-kp-text-primary focus:border-kp-primary focus:outline-none"
          >
            <option value="">{t('filters.allTypes')}</option>
            <option value="sales_invoice">{t('types.salesInvoice')}</option>
            <option value="payment">{t('types.payment')}</option>
          </select>
        </div>

        <button
          onClick={fetchDocs}
          className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-medium text-kp-text-secondary hover:bg-kp-bg-hover"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {t('actions.refresh')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-kp-lg border border-kp-border bg-kp-surface-card">
        <table className="min-w-full divide-y divide-kp-border text-left text-xs">
          <thead className="bg-kp-bg-muted/50 text-kp-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('documents.colType')}</th>
              <th className="px-4 py-3 font-semibold">{t('documents.colReference')}</th>
              <th className="px-4 py-3 font-semibold">{t('documents.colExternalNumber')}</th>
              <th className="px-4 py-3 font-semibold">{t('documents.colAmount')}</th>
              <th className="px-4 py-3 font-semibold">{t('documents.colStatus')}</th>
              <th className="px-4 py-3 font-semibold">{t('documents.colDate')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('documents.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border text-kp-text-primary">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-kp-text-muted">
                  {isLoading ? t('documents.loading') : t('documents.noRecords')}
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-kp-bg-hover/50">
                  <td className="px-4 py-3 font-medium">
                    {doc.type === 'sales_invoice' ? t('types.salesInvoice') : t('types.payment')}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-kp-text-secondary">
                    {doc.referenceCode}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    {doc.externalNumber || doc.externalId || '-'}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {Number(doc.totalAmount).toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    {doc.currency}
                  </td>
                  <td className="px-4 py-3">
                    {renderStatus(doc.status, doc.errorMessage)}
                  </td>
                  <td className="px-4 py-3 text-kp-text-muted">
                    {new Date(doc.createdAt).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedRawDoc(doc)}
                        className="rounded p-1 text-kp-text-muted hover:bg-kp-bg-hover hover:text-kp-text-primary"
                        title={t('actions.viewPayload')}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>

                      {doc.status === 'pending' && (
                        <button
                          onClick={() => handleCancelClaim(doc)}
                          disabled={cancellingId === doc.id}
                          className="text-[11px] font-medium text-red-400 hover:text-red-300 underline"
                        >
                          {t('actions.cancelClaim')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Raw JSON Modal */}
      {selectedRawDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-kp-lg bg-kp-surface-card p-5 shadow-2xl border border-kp-border">
            <div className="flex items-center justify-between pb-3 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary">
                {t('documents.rawTitle')} — {selectedRawDoc.referenceCode}
              </h3>
              <button
                onClick={() => setSelectedRawDoc(null)}
                className="text-kp-text-muted hover:text-kp-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 max-h-96 overflow-y-auto rounded bg-black/40 p-3 font-mono text-xs text-emerald-400">
              <pre>
                {JSON.stringify(
                  {
                    id: selectedRawDoc.id,
                    referenceCode: selectedRawDoc.referenceCode,
                    status: selectedRawDoc.status,
                    externalId: selectedRawDoc.externalId,
                    externalNumber: selectedRawDoc.externalNumber,
                    errorMessage: selectedRawDoc.errorMessage,
                    rawResponse: selectedRawDoc.rawResponse,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
