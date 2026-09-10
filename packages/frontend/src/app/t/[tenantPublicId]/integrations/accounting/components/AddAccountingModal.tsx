'use client';

import { useEffect, useState } from 'react';
import {
  XMarkIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
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
  {
    id: 'BIZIMHESAP',
    displayName: 'BizimHesap',
    country: 'TR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'BIZIMHESAP',
      name: 'BizimHesap',
      fields: [
        { key: 'firmId', label: 'Firma ID / Kod (firmId)', type: 'password', required: true, secret: true },
        { key: 'key', label: 'API Anahtarı (key)', type: 'password', required: true, secret: true },
        { key: 'token', label: 'API Belirteci (token)', type: 'password', required: true, secret: true },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'SAP_S4HANA_CLOUD',
    displayName: 'SAP S/4HANA Cloud',
    country: 'DE',
    protocol: 'odata',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'SAP_S4HANA_CLOUD',
      name: 'SAP S/4HANA Cloud (Public Edition)',
      fields: [
        { key: 'apiKey', label: 'Sandbox API Key (sandbox.api.sap.com)', type: 'password', required: false, secret: true },
        { key: 'baseUrl', label: 'Tenant API Base URL', type: 'url', required: false },
        { key: 'username', label: 'Communication User', type: 'text', required: false },
        { key: 'password', label: 'Communication Password', type: 'password', required: false, secret: true },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'NOT_SUPPORTED', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'MS_DYNAMICS_BC_ONLINE',
    displayName: 'Dynamics 365 Business Central Online',
    country: 'US',
    protocol: 'odata',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'MS_DYNAMICS_BC_ONLINE',
      name: 'Microsoft Dynamics 365 Business Central Online',
      fields: [
        { key: 'aadTenantId', label: 'Microsoft Entra Directory (Tenant) ID', type: 'text', required: true },
        { key: 'environmentName', label: 'Ortam Adı (production / sandbox)', type: 'text', required: true },
        { key: 'companyId', label: 'Business Central Company ID (GUID)', type: 'text', required: true },
        { key: 'userDomain', label: 'Kullanıcı Alan Adı (Opsiyonel)', type: 'text', required: false },
        { key: 'clientId', label: 'Özel Client ID (Opsiyonel)', type: 'text', required: false },
        { key: 'clientSecret', label: 'Özel Client Secret (Opsiyonel)', type: 'password', required: false, secret: true },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
];

const PROVIDER_THEMES: Record<string, { bg: string; text: string; badge: string; iconLetter: string }> = {
  PARASUT: {
    bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'Paraşüt E-Fatura',
    iconLetter: 'P',
  },
  KOLAYBI: {
    bg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: "KolayBi'",
    iconLetter: 'K',
  },
  BIZIMHESAP: {
    bg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20',
    text: 'text-teal-600 dark:text-teal-400',
    badge: 'BizimHesap',
    iconLetter: 'B',
  },
  SAP_S4HANA_CLOUD: {
    bg: 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'SAP S/4HANA Cloud',
    iconLetter: 'S',
  },
  MS_DYNAMICS_BC_ONLINE: {
    bg: 'bg-cyan-600/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    badge: 'Dynamics 365 BC',
    iconLetter: 'D',
  },
};

interface AddAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingIntegration?: AccountingIntegrationItem | null;
  initialProviderId?: string;
}

export default function AddAccountingModal({
  isOpen,
  onClose,
  onSuccess,
  editingIntegration,
  initialProviderId,
}: AddAccountingModalProps) {
  const t = useTranslations('accounting');
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolveProviderId = (id?: string | null) => {
    if (!id) return 'PARASUT';
    const lower = id.toLowerCase();
    if (lower === 'sap' || lower === 'sap_s4hana_cloud') return 'SAP_S4HANA_CLOUD';
    if (
      lower === 'ms_dynamics' ||
      lower === 'ms_dynamics_bc_online' ||
      lower === 'ms-dynamics-bc-online' ||
      lower === 'dynamics'
    )
      return 'MS_DYNAMICS_BC_ONLINE';
    const match = DEFAULT_PROVIDERS.find((p) => p.id.toLowerCase() === lower);
    return match ? match.id : id.toUpperCase();
  };

  const [providers, setProviders] = useState<AccountingProviderInfo[]>(DEFAULT_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    if (editingIntegration?.provider) return resolveProviderId(editingIntegration.provider);
    if (initialProviderId) return resolveProviderId(initialProviderId);
    return 'PARASUT';
  });

  const [name, setName] = useState<string>(() => {
    if (editingIntegration?.name) return editingIntegration.name;
    const pid = initialProviderId ? resolveProviderId(initialProviderId) : 'PARASUT';
    const match = DEFAULT_PROVIDERS.find((p) => p.id === pid);
    return match ? `${match.displayName} Muhasebe` : 'Muhasebe Entegrasyonu';
  });

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
      const pid = resolveProviderId(editingIntegration.provider);
      setSelectedProviderId(pid);
      setName(editingIntegration.name);
      setEnvironment(editingIntegration.environment);
      setCredentials((editingIntegration.credentials as Record<string, string>) || {});
    }
  }, [editingIntegration]);

  useEffect(() => {
    if (initialProviderId && !editingIntegration && isOpen) {
      const pid = resolveProviderId(initialProviderId);
      setSelectedProviderId(pid);
      const match = providers.find((p) => p.id === pid) || DEFAULT_PROVIDERS.find((p) => p.id === pid);
      if (match) {
        setName(`${match.displayName} Muhasebe`);
      }
    }
  }, [initialProviderId, editingIntegration, providers, isOpen]);

  const activeProvider =
    providers.find((p) => p.id.toUpperCase() === selectedProviderId.toUpperCase()) ||
    providers[0] ||
    DEFAULT_PROVIDERS[0];

  const isProviderLocked = Boolean(initialProviderId || editingIntegration);

  const theme = PROVIDER_THEMES[activeProvider.id.toUpperCase()] || {
    bg: 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    badge: activeProvider.displayName,
    iconLetter: activeProvider.displayName.charAt(0),
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-scale-in">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold text-base shadow-xs ${theme.bg}`}>
                {theme.iconLetter}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingIntegration
                      ? `${activeProvider.displayName} Ayarlarını Düzenle`
                      : `${activeProvider.displayName} Bağlantı Kurulumu`}
                  </h2>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${theme.bg}`}>
                    {theme.badge}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {activeProvider.displayName} API kimlik ve entegrasyon bilgilerini tanımlayın
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
            {/* MOCK_READY Notice Banner for the active provider */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-950 dark:text-amber-100">
                  MOCK_READY Entegrasyon:
                </span>{' '}
                {activeProvider.displayName} API erişimi güvenli simülasyon modunda çalışmaktadır. TEST ve PRODUCTION modları canlı kimlik bilgileri onaylanana kadar korumalıdır ve ağ isteği yapmaz.
              </div>
            </div>

            {/* Dynamics 365 BC Entra ID Onboarding Guidance (§3.2, §9) */}
            {selectedProviderId === 'MS_DYNAMICS_BC_ONLINE' && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/30 p-4 text-xs text-cyan-900 dark:text-cyan-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyan-950 dark:text-cyan-100">
                  <InformationCircleIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Microsoft Entra ID & Business Central Kurulum Adımları
                </div>
                <ol className="list-decimal list-inside space-y-1 text-cyan-800 dark:text-cyan-300">
                  <li><strong>Entra ID:</strong> Uygulama kaydı oluşturun, <code>API.ReadWrite.All</code> Application izni ekleyin.</li>
                  <li><strong>Business Central:</strong> &quot;Microsoft Entra Applications&quot; sayfasında Client ID kaydedip <code>D365 BASIC</code> ve <code>D365 SALES DOC, EDIT</code> izin kümelerini atayın.</li>
                  <li><strong>Grant Consent:</strong> Kart üzerindeki &quot;Grant Consent&quot; butonuyla onay verin.</li>
                </ol>
                <p className="text-[11px] text-cyan-700 dark:text-cyan-400 pt-1 border-t border-cyan-500/20">
                  * HTTP 403 hatası alınıyorsa Entra doğrulaması başarılıdır ancak Business Central içindeki izin kümeleri eksiktir.
                </p>
              </div>
            )}

            {/* Provider Selector (ONLY visible when opened generically without a specific pre-selected provider) */}
            {!isProviderLocked && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Muhasebe Programı Seçin <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {providers.map((p) => {
                    const isSelected = p.id.toUpperCase() === selectedProviderId.toUpperCase();
                    const pTheme = PROVIDER_THEMES[p.id.toUpperCase()] || theme;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProviderChange(p.id)}
                        className={`group flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm ring-1 ring-blue-600/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm'
                                : `${pTheme.bg}`
                            }`}
                          >
                            {pTheme.iconLetter}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-slate-900 dark:text-white">
                              {p.displayName}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {p.protocol.toUpperCase()} · {p.readiness}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Integration Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('fields.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                placeholder="Örn: Muhasebe Şirketi"
              />
            </div>

            {/* Environment Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('fields.environment')}
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="MOCK">{t('env.mock')} (Güvenli Simülasyon)</option>
                <option value="TEST">{t('env.test')} (Canlı Doğrulama Gerekli)</option>
                <option value="PRODUCTION">{t('env.production')} (Canlı Doğrulama Gerekli)</option>
              </select>
              {environment !== 'MOCK' && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                  <InformationCircleIcon className="h-4 w-4 shrink-0" />
                  {t('env.warningNonMock')}
                </p>
              )}
            </div>

            {/* Dynamic Provider Credential Fields */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {activeProvider.displayName} Bağlantı Bilgileri
                </h3>
                <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                  {activeProvider.displayName} panelinizden temin ettiğiniz API erişim bilgilerini girin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeProvider.credentialSchema?.fields?.map((field) => {
                  const isSecret = field.type === 'password' || field.secret;
                  const currentValue = credentials[field.key] || '';
                  return (
                    <div
                      key={field.key}
                      className={field.type === 'url' ? 'col-span-full space-y-1' : 'space-y-1'}
                    >
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {field.label} {field.required ? <span className="text-red-500">*</span> : ''}
                      </label>
                      <input
                        type={field.type === 'password' ? 'password' : 'text'}
                        required={field.required && !editingIntegration}
                        value={currentValue}
                        onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
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
          </div>

          {/* Footer Actions */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>{t('actions.saving')}</span>
                </>
              ) : (
                <span>{t('actions.save')}</span>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
