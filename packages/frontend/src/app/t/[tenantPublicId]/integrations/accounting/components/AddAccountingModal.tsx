'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon, ShieldCheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AccountingIntegrationItem, AccountingProviderInfo } from '../types';

interface AddAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingIntegration?: AccountingIntegrationItem | null;
}

const DEFAULT_PROVIDERS: AccountingProviderInfo[] = [
  {
    id: 'PARASUT',
    displayName: 'Paraşüt',
    country: 'TR',
    protocol: 'jsonapi',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'PARASUT',
      name: 'Paraşüt',
      fields: [
        { key: 'clientId', label: 'Client ID (Uygulama Kimliği)', type: 'text', required: true },
        { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, secret: true },
        { key: 'username', label: 'Kullanıcı Adı (E-posta)', type: 'text', required: true },
        { key: 'password', label: 'Şifre', type: 'password', required: true, secret: true },
        { key: 'companyId', label: 'Firma ID (Company ID)', type: 'text', required: true },
        { key: 'redirectUri', label: 'Redirect URI', type: 'text', required: false },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'KOLAYBI',
    displayName: "KolayBi'",
    country: 'TR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'KOLAYBI',
      name: "KolayBi'",
      fields: [
        { key: 'apiKey', label: 'API Anahtarı (API Key)', type: 'password', required: true, secret: true },
        { key: 'channel', label: 'Kanal Kodu (Channel)', type: 'text', required: true },
        { key: 'baseUrl', label: 'API Base URL', type: 'url', required: false },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
];

export default function AddAccountingModal({
  isOpen,
  onClose,
  onSuccess,
  editingIntegration,
}: AddAccountingModalProps) {
  const t = useTranslations('accounting');
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [providers, setProviders] = useState<AccountingProviderInfo[]>(DEFAULT_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    editingIntegration?.provider || 'PARASUT',
  );
  const [name, setName] = useState(editingIntegration?.name || 'Paraşüt Muhasebe');
  const [environment, setEnvironment] = useState<'MOCK' | 'TEST' | 'PRODUCTION'>(
    editingIntegration?.environment || 'MOCK',
  );
  const [credentials, setCredentials] = useState<Record<string, string>>(
    (editingIntegration?.credentials as Record<string, string>) || {},
  );

  useEffect(() => {
    if (!isOpen) return;

    api
      .get<AccountingProviderInfo[]>('/accounting/providers')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setProviders(res);
        }
      })
      .catch(() => {
        // keep fallback DEFAULT_PROVIDERS
      });
  }, [isOpen]);

  useEffect(() => {
    if (editingIntegration) {
      setSelectedProviderId(editingIntegration.provider);
      setName(editingIntegration.name);
      setEnvironment(editingIntegration.environment);
      setCredentials((editingIntegration.credentials as Record<string, string>) || {});
    } else {
      const activeP = providers.find((p) => p.id === selectedProviderId) || providers[0];
      if (activeP) {
        setName(`${activeP.displayName} Muhasebe`);
      }
    }
  }, [selectedProviderId, editingIntegration, providers]);

  const activeProvider =
    providers.find((p) => p.id.toUpperCase() === selectedProviderId.toUpperCase()) || providers[0];

  const handleProviderChange = (newId: string) => {
    setSelectedProviderId(newId);
    const p = providers.find((pr) => pr.id === newId);
    if (p && !editingIntegration) {
      setName(`${p.displayName} Muhasebe`);
      setCredentials({});
    }
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

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
          provider: selectedProviderId,
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
              {activeProvider?.displayName?.charAt(0) || 'M'}
            </div>
            <div>
              <h2 className="text-base font-semibold text-kp-text-primary">
                {editingIntegration ? t('modals.editTitle') : t('modals.createTitle')}
              </h2>
              <p className="text-xs text-kp-text-muted">{t('modals.subtitle')}</p>
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
          {/* Provider Selector (enabled only on create) */}
          {!editingIntegration && (
            <div>
              <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                {t('fields.provider')} *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((p) => {
                  const isSelected = p.id.toUpperCase() === selectedProviderId.toUpperCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id)}
                      className={`flex items-center justify-between rounded-kp-md border p-2.5 text-left transition-all ${
                        isSelected
                          ? 'border-kp-primary bg-kp-primary/10 text-kp-primary'
                          : 'border-kp-border bg-kp-bg-input text-kp-text-secondary hover:border-kp-border-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-kp-surface-elevated text-xs font-bold">
                          {p.displayName.charAt(0)}
                        </span>
                        <div>
                          <p className="text-xs font-semibold">{p.displayName}</p>
                          <p className="text-[10px] opacity-70">
                            {p.protocol.toUpperCase()} · {p.readiness}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-kp-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              placeholder="Örn: Muhasebe Şirketi"
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

          {/* Dynamic Provider Credential Fields */}
          <div className="border-t border-kp-border/60 pt-3">
            <h4 className="text-xs font-semibold text-kp-text-primary mb-2">
              {activeProvider.displayName} Bağlantı Bilgileri
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeProvider.credentialSchema?.fields?.map((field) => {
                const isSecret = field.type === 'password' || field.secret;
                const currentValue = credentials[field.key] || '';
                return (
                  <div
                    key={field.key}
                    className={field.type === 'url' ? 'col-span-full' : ''}
                  >
                    <label className="block text-xs font-medium text-kp-text-secondary mb-1">
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      required={field.required && !editingIntegration}
                      value={currentValue}
                      onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                      className="w-full rounded-kp-md border border-kp-border bg-kp-bg-input px-3 py-2 text-sm text-kp-text-primary focus:border-kp-primary focus:outline-none"
                      placeholder={
                        editingIntegration && isSecret && currentValue
                          ? '••••••••'
                          : field.description || field.label
                      }
                    />
                  </div>
                );
              })}
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
