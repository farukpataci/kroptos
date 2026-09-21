'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, EnvelopeIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import type { InvitationRow } from '../hooks/useInvitations';
import type { RoleRow } from '../hooks/useRoles';
import type { AvailableStore } from '../hooks/useUsers';

interface Props {
  invitations: InvitationRow[];
  roles: RoleRow[];
  stores: AvailableStore[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onResend: (id: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}

export default function PendingInvitations({ invitations, roles, stores, isLoading, error, onRetry, onResend, onRevoke }: Props) {
  const t = useTranslations('system.invitations');
  const tc = useTranslations('common');
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (id: string, fn: (id: string) => Promise<void>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn(id);
      toast.success(okMsg);
    } catch (err: any) {
      toast.error(err?.message || tc('unknownError'));
    } finally {
      setBusyId(null);
    }
  };

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? '—';
  const scopeName = (inv: InvitationRow) => (inv.storeId ? stores.find((s) => s.id === inv.storeId)?.name ?? inv.storeId : t('scopeAgency'));

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 px-4 py-3">
        <p className="flex-1 text-xs text-kp-danger">{error}</p>
        <button onClick={onRetry} className="text-xs font-medium text-kp-danger hover:underline">{tc('actions.retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('pendingTitle')} ({invitations.length})</h4>
      <div className="card overflow-hidden">
        <table className="kp-table w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-2.5 px-4">{t('email')}</th>
              <th className="py-2.5 px-4">{t('role')}</th>
              <th className="py-2.5 px-4">{t('scope')}</th>
              <th className="py-2.5 px-4">{t('expiresAt')}</th>
              <th className="py-2.5 px-4 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (<td key={j} className="py-3 px-4"><div className="h-3 rounded bg-kp-bg-tertiary animate-pulse w-2/3" /></td>))}</tr>
              ))
            ) : invitations.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-xs text-kp-text-tertiary">{t('empty')}</td></tr>
            ) : (
              invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                  <td className="py-2.5 px-4 text-xs font-medium text-kp-text-primary">{inv.email}</td>
                  <td className="py-2.5 px-4 text-xs">{roleName(inv.roleId)}</td>
                  <td className="py-2.5 px-4 text-xs">{scopeName(inv)}</td>
                  <td className="py-2.5 px-4 text-xs text-kp-text-tertiary">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button disabled={busyId === inv.id} onClick={() => act(inv.id, onResend, t('resent'))} title={t('resend')} className="p-1 text-kp-text-tertiary hover:text-kp-accent transition-colors disabled:opacity-40">
                        {busyId === inv.id ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <EnvelopeIcon className="h-4 w-4" />}
                      </button>
                      <button disabled={busyId === inv.id} onClick={() => act(inv.id, onRevoke, t('revoked'))} title={t('revoke')} className="p-1 text-kp-text-tertiary hover:text-kp-danger transition-colors disabled:opacity-40">
                        <NoSymbolIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
