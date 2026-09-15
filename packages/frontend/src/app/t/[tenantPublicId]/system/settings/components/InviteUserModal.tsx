'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ClipboardDocumentIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import type { RoleRow } from '../hooks/useRoles';
import type { AvailableStore } from '../hooks/useUsers';
import type { InvitationRow } from '../hooks/useInvitations';

interface Props {
  roles: RoleRow[];
  stores: AvailableStore[];
  onClose: () => void;
  onInvite: (payload: { email: string; roleId: string; storeId?: string }) => Promise<InvitationRow & { devInviteUrl?: string }>;
}

export default function InviteUserModal({ roles, stores, onClose, onInvite }: Props) {
  const t = useTranslations('system.invitations');
  const tc = useTranslations('common');
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(roles.find((r) => !r.isSystem || r.key === 'viewer')?.id ?? roles[0]?.id ?? '');
  const [storeId, setStoreId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TODO(P8): gercek mail saglayicisi gelince kaldir - backend devInviteUrl'i yalniz production disinda donuyor.
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await onInvite({ email: email.trim(), roleId, ...(storeId ? { storeId } : {}) });
      toast.success(t('sent', { email: created.email }));
      if (created.devInviteUrl) setDevLink(created.devInviteUrl);
      else onClose();
    } catch (err: any) {
      // Backend 400/403/429 govdesi anlamli: "reserved", "do not hold", "Rate limit"...
      setError(err?.message || tc('unknownError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignable = roles.filter((r) => r.key !== 'super_admin');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
          <div>
            <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('modalTitle')}</h3>
            <p className="text-[0.6875rem] text-kp-text-tertiary">{t('modalDesc')}</p>
          </div>
          <button onClick={onClose} className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {devLink ? (
          <div className="p-6 space-y-4">
            <div className="rounded-kp-md bg-amber-500/5 border border-amber-500/15 px-3 py-2.5 text-[0.6875rem] text-amber-400">
              {t('devLinkNote')}
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={devLink} className="flex-1 bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs font-mono text-kp-text-primary" />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(devLink).then(() => toast.info(t('copied')))}
                className="flex items-center gap-1 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary"
              >
                <ClipboardDocumentIcon className="h-4 w-4" /> {t('copy')}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold">
                {tc('actions.close')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('email')}</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('role')}</label>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent">
                  {assignable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.isSystem ? '' : ` · ${t('customRole')}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('scope')}</label>
                <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent">
                  <option value="">{t('scopeAgency')}</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{t('scopeStore', { name: s.name })}</option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors">
                {tc('actions.cancel')}
              </button>
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
                {isSubmitting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                {t('send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
