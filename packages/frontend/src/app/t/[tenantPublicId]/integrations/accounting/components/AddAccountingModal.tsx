'use client';

import { useState } from 'react';
import { XMarkIcon, ShieldCheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AccountingIntegrationItem } from '../types';

interface AddAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingIntegration?: AccountingIntegrationItem | null;
}

export default function AddAccountingModal({
  isOpen,
  onClose,
  onSuccess,
  editingIntegration,
}: AddAccountingModalProps) {
  const t = useTranslations('accounting');
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [provider] = useState('PARASUT');
  const [name, setName] = useState(editingIntegration?.name || 'Paraşüt Muhasebe');
  const [environment, setEnvironment] = useState<'MOCK' | 'TEST' | 'PRODUCTION'>(
    editingIntegration?.environment || 'MOCK',
  );

  const [credentials, setCredentials] = useState({
    clientId: editingIntegration?.credentials?.clientId || '',
    clientSecret: editingIntegration?.credentials?.clientSecret || '',
    username: editingIntegration?.credentials?.username || '',
    password: editingIntegration?.credentials?.password || '',
    companyId: editingIntegration?.credentials?.companyId || '',
    redirectUri: editingIntegration?.credentials?.redirectUri || 'urn:ietf:wg:oauth:2.0:oob',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingIntegration) {
        await api.patch(`/accounting/integrations/${editingIntegration.id}`, {
          name,
          environment,
          credentials,
        });
        toast.success(t('messages.updateSuccess'));
      } else {
        await api.post('/accounting/integrations', {
          provider,
          name,
          environment,
          credentials,
        });
        toast.success(t('messages.createSuccess'));
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('messages.operationFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-kp-lg bg-kp-surface-card p-6 shadow-2xl border border-kp-border">
        <div className="flex items-center justify-between pb-4 border-b border-kp-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-blue-500/10 text-blue-500 font-bold text-lg">
              P
            </div>
            <div>
              <h2 className="text-base font-semibold text-kp-text-primary">
                {editingIntegration ? t('modals.editTitle') : t('modals.createTitle')}
              </h2>
              <p className="text-xs text-kp-text-muted">
                {t('modals.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-kp-md p-1.5 text-kp-text-muted hover:bg-kp-bg-hover hover:text-kp-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

          {/* MOCK_READY Notice Banner */}
          <div className="my-4 rounded-kp-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
            <ShieldCheckIcon className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-200">
                {t('banner.mockReadyTitle')}:
              </span>{' '}
              {t('banner.mockReadyDesc')}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                {t('fields.name')} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                placeholder="Örn: Paraşüt Ana Şirket"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                {t('fields.environment')}
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
              >
                <option value="MOCK">{t('env.mock')} (Güvenli Simülasyon)</option>
                <option value="TEST">{t('env.test')} (Canlı Doğrulama Gerekli)</option>
                <option value="PRODUCTION">{t('env.production')} (Canlı Doğrulama Gerekli)</option>
              </select>
              {environment !== 'MOCK' && (
                <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <InformationCircleIcon className="h-3.5 w-3.5" />
                  {t('env.warningNonMock')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                  Client ID (Uygulama ID) *
                </label>
                <input
                  type="text"
                  required
                  value={credentials.clientId}
                  onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                  placeholder="App Client ID"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                  Client Secret (Gizli Anahtar) *
                </label>
                <input
                  type="password"
                  required={!editingIntegration}
                  value={credentials.clientSecret}
                  onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                  placeholder={editingIntegration ? '••••••••' : 'App Client Secret'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                  Kullanıcı Adı (E-posta) *
                </label>
                <input
                  type="email"
                  required
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                  placeholder="admin@firma.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                  Şifre *
                </label>
                <input
                  type="password"
                  required={!editingIntegration}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                  placeholder={editingIntegration ? '••••••••' : 'Şifre'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                  Firma ID (Company ID) *
                </label>
                <input
                  type="text"
                  required
                  value={credentials.companyId}
                  onChange={(e) => setCredentials({ ...credentials, companyId: e.target.value })}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                  placeholder="123456"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                  Redirect URI
                </label>
                <input
                  type="text"
                  value={credentials.redirectUri}
                  onChange={(e) => setCredentials({ ...credentials, redirectUri: e.target.value })}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                  placeholder="urn:ietf:wg:oauth:2.0:oob"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-kp-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-medium text-kp-text-secondary hover:bg-kp-bg-hover"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-kp-md bg-kp-primary px-4 py-2 text-xs font-medium text-white hover:bg-kp-primary-hover disabled:opacity-50"
              >
                {isSubmitting ? t('actions.saving') : t('actions.save')}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}
