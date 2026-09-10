'use client';

import { useEffect, useState } from 'react';
import {
  XMarkIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  BanknotesIcon,
  ArrowPathIcon,
  LinkIcon,
  ExclamationTriangleIcon,
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
        {
          key: 'aadTenantId',
          label: 'Microsoft Entra (Azure AD) Directory / Tenant ID',
          type: 'text',
          required: true,
          description: 'Azure Portal / Entra ID genel bakışında yer alan Directory (tenant) ID GUID değeri.',
        },
        {
          key: 'environmentName',
          label: 'Ortam Adı (Environment Name)',
          type: 'text',
          required: true,
          defaultValue: 'production',
          description: 'Business Central ortamı: "production", "sandbox" veya şirketinizin özel ortam adı.',
        },
        {
          key: 'companyId',
          label: 'Business Central Şirket Kimliği (Company ID GUID)',
          type: 'text',
          required: true,
          description: 'İşlemlerin yürütüleceği Business Central Company GUID değeri.',
        },
        {
          key: 'userDomain',
          label: 'Kullanıcı Alan Adı (User Domain - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Doğrudan kiracı URL yapısı kullanılıyorsa (ör. firmaniz.com), aksi halde boş bırakınız.',
        },
        {
          key: 'clientId',
          label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Kendi özel Entra ID uygulamanızı kullanmak isterseniz giriniz; boşsa merkezi KroptOS çok kiracılı uygulaması kullanılır.',
        },
        {
          key: 'clientSecret',
          label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
          type: 'password',
          required: false,
          secret: true,
          description: 'Özel Entra ID uygulamanızın istemci parolası (Client Secret).',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'SAGE-ACCOUNTING',
    displayName: 'Sage Business Cloud Accounting',
    country: 'GB',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'SAGE-ACCOUNTING',
      name: 'Sage Business Cloud Accounting',
      fields: [
        { key: 'businessId', label: 'Sage İşletme Kimliği (Business ID)', type: 'text', required: true, description: 'Sage panelinizdeki işletme ID değeri veya GET /businesses çıktısı.' },
        { key: 'defaultLedgerAccountId', label: 'Varsayılan Gelir Defteri Hesabı (Ledger Account ID)', type: 'text', required: false, description: 'Fatura satırlarında kullanılacak nominal gelir hesabı (ör. 4000).' },
        { key: 'defaultTaxRateId', label: 'Varsayılan Vergi Oranı (Tax Rate ID)', type: 'text', required: false, description: 'Fatura satırlarında geçerli Sage vergi oranı (ör. GB_STANDARD).' },
        { key: 'clientId', label: 'Özel Client ID (İsteğe Bağlı)', type: 'text', required: false, description: 'Özel Sage Developer uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.' },
        { key: 'clientSecret', label: 'Özel Client Secret (İsteğe Bağlı)', type: 'password', required: false, secret: true, description: 'Özel uygulamanızın istemci gizli anahtarı.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'XERO',
    displayName: 'Xero',
    country: 'NZ',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'xero',
      name: 'Xero',
      fields: [
        { key: 'tenantId', label: 'Xero Kuruluş / Tenant Kimliği (Tenant ID)', type: 'text', required: true, description: 'Xero üzerindeki bağlı organizasyon / tenant kimliği.' },
        { key: 'tenantName', label: 'Kuruluş Adı (Organization Name)', type: 'text', required: false, description: 'Bağlı organizasyonun adı.' },
        { key: 'accountCode', label: 'Satış Gelir Hesabı Kodu (Account Code)', type: 'text', required: false, description: 'Xero genel muhasebe satış hesabı kodu (varsayılan: 200).' },
        { key: 'bankAccountCode', label: 'Banka Hesabı Kodu (Bank Account Code)', type: 'text', required: false, description: 'Ödemeler için Xero banka hesap kodu (varsayılan: 090).' },
        { key: 'clientId', label: 'Özel Client ID (İsteğe Bağlı)', type: 'text', required: false, description: 'Özel Xero Developer uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.' },
        { key: 'clientSecret', label: 'Özel Client Secret (İsteğe Bağlı)', type: 'password', required: false, secret: true, description: 'Özel uygulamanızın istemci gizli anahtarı.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
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
  'SAGE-ACCOUNTING': {
    bg: 'bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'Sage Business Cloud',
    iconLetter: 'S',
  },
  XERO: {
    bg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/20',
    text: 'text-sky-600 dark:text-sky-400',
    badge: 'Xero Accounting',
    iconLetter: 'X',
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

  const resolveProviderId = (id?: string | null): string => {
    if (!id) return 'PARASUT';
    const lower = id.toLowerCase().replace(/[-_]/g, '');
    if (lower.includes('sap')) return 'SAP_S4HANA_CLOUD';
    if (
      lower.includes('dynamics') ||
      lower.includes('msdynamics') ||
      lower === 'msbc' ||
      lower.includes('businesscentral')
    )
      return 'MS_DYNAMICS_BC_ONLINE';
    if (lower.includes('sage')) return 'SAGE-ACCOUNTING';
    if (lower.includes('xero')) return 'XERO';
    if (lower.includes('kolaybi')) return 'KOLAYBI';
    if (lower.includes('bizimhesap')) return 'BIZIMHESAP';
    if (lower.includes('parasut')) return 'PARASUT';

    const match = DEFAULT_PROVIDERS.find(
      (p) => p.id.toLowerCase().replace(/[-_]/g, '') === lower,
    );
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
    const match =
      DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === pid) ||
      DEFAULT_PROVIDERS.find((p) => p.id === pid);
    return match ? `${match.displayName} Muhasebe` : 'Muhasebe Entegrasyonu';
  });

  const [environment, setEnvironment] = useState<'MOCK' | 'TEST' | 'PRODUCTION'>(
    editingIntegration?.environment || 'MOCK',
  );
  const [credentials, setCredentials] = useState<Record<string, string>>(
    (editingIntegration?.credentials as Record<string, string>) || {},
  );

  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<any[]>([]);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<any[]>([]);
  const [discoveredTaxRates, setDiscoveredTaxRates] = useState<any[]>([]);

  // Dynamics 365 discovery state
  const [isDiscoveringDynamics, setIsDiscoveringDynamics] = useState(false);
  const [discoveredDynamicsCompanies, setDiscoveredDynamicsCompanies] = useState<any[]>([]);

  const resolvedProviderKey = resolveProviderId(selectedProviderId);

  const activeProvider =
    providers.find((p) => resolveProviderId(p.id) === resolvedProviderKey) ||
    DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === resolvedProviderKey) ||
    providers.find((p) => p.id.toUpperCase() === selectedProviderId.toUpperCase()) ||
    DEFAULT_PROVIDERS.find((p) => p.id.toUpperCase() === selectedProviderId.toUpperCase()) ||
    DEFAULT_PROVIDERS[0];

  const isDynamics = resolvedProviderKey === 'MS_DYNAMICS_BC_ONLINE';
  const isSage = resolvedProviderKey === 'SAGE-ACCOUNTING';
  const isXero = resolvedProviderKey === 'XERO';
  const isSap = resolvedProviderKey === 'SAP_S4HANA_CLOUD';

  const isReauthRequired =
    (isSage || isXero) &&
    ((editingIntegration?.status as string) === 'failed' ||
      (editingIntegration?.status === 'error' &&
        (editingIntegration?.lastErrorMessage?.includes('REAUTHORIZATION_REQUIRED') ||
          editingIntegration?.lastErrorMessage?.includes('invalid_grant'))));

  const handleStartOAuth = async () => {
    if (!editingIntegration?.id) {
      toast.error('OAuth başlatmak için lütfen önce entegrasyonu kaydedin.');
      return;
    }
    setIsStartingOAuth(true);
    try {
      const redirectUri = window.location.origin + '/api/accounting/oauth/callback';
      const res = await api.post<{ authorizationUrl: string }>(
        `/accounting/integrations/${editingIntegration.id}/oauth/start`,
        { redirectUri },
      );
      if (res?.authorizationUrl) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popupName = isXero ? 'XeroOAuth' : 'SageOAuth';
        const popup = window.open(
          res.authorizationUrl,
          popupName,
          `width=${width},height=${height},top=${top},left=${left}`,
        );

        const onMessage = (event: MessageEvent) => {
          if (event.data?.type === 'ACCOUNTING_OAUTH_RESULT') {
            window.removeEventListener('message', onMessage);
            if (event.data.success) {
              toast.success(`${isXero ? 'Xero' : 'Sage'} OAuth yetkilendirmesi başarıyla tamamlandı!`);
              onSuccess();
            } else {
              toast.error(event.data.message || 'Yetkilendirme başarısız oldu.');
            }
          }
        };
        window.addEventListener('message', onMessage);
      }
    } catch (err: any) {
      toast.error(err.message || 'OAuth yönlendirmesi başlatılamadı.');
    } finally {
      setIsStartingOAuth(false);
    }
  };

  const handleDiscoverConfig = async () => {
    if (!editingIntegration?.id) {
      toast.error('Yapılandırma keşfi için önce entegrasyonu kaydedin.');
      return;
    }
    setIsDiscovering(true);
    try {
      const [bizs, accs, taxes] = await Promise.all([
        api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/businesses`).catch(() => []),
        api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/ledger-accounts`).catch(() => []),
        api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/tax-rates`).catch(() => []),
      ]);
      setDiscoveredBusinesses(bizs || []);
      setDiscoveredAccounts(accs || []);
      setDiscoveredTaxRates(taxes || []);
      toast.success('Sage yapılandırma seçenekleri güncellendi.');
    } catch (err: any) {
      toast.error(err.message || 'Yapılandırma verileri çekilemedi.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleDiscoverDynamicsCompanies = async () => {
    if (!editingIntegration?.id) {
      toast.error('Şirket listesini çekmek için önce entegrasyonu kaydedin.');
      return;
    }
    setIsDiscoveringDynamics(true);
    try {
      const companies = await api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/businesses`);
      setDiscoveredDynamicsCompanies(companies || []);
      toast.success('Business Central şirketleri listelendi.');
    } catch (err: any) {
      toast.error(err.message || 'Şirket listesi alınamadı.');
    } finally {
      setIsDiscoveringDynamics(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    api
      .get<AccountingProviderInfo[]>('/accounting/providers')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setProviders(() => {
            const merged = [...DEFAULT_PROVIDERS];
            for (const item of res) {
              const idx = merged.findIndex(
                (m) =>
                  m.id.toUpperCase() === item.id.toUpperCase() ||
                  resolveProviderId(m.id) === resolveProviderId(item.id),
              );
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...item };
              } else {
                merged.push(item);
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {
        // keep fallback DEFAULT_PROVIDERS
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingIntegration) {
      const pid = resolveProviderId(editingIntegration.provider);
      setSelectedProviderId(pid);
      setName(editingIntegration.name);
      setEnvironment(editingIntegration.environment);
      setCredentials((editingIntegration.credentials as Record<string, string>) || {});
    } else if (initialProviderId) {
      const pid = resolveProviderId(initialProviderId);
      setSelectedProviderId(pid);
      const match =
        DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === pid) ||
        providers.find((p) => resolveProviderId(p.id) === pid);
      if (match) {
        setName(`${match.displayName} Muhasebe`);
        const defaultCreds: Record<string, string> = {};
        match.credentialSchema?.fields?.forEach((f) => {
          if (f.defaultValue) defaultCreds[f.key] = f.defaultValue;
        });
        setCredentials(defaultCreds);
      }
    }
  }, [isOpen, initialProviderId, editingIntegration]);

  const isProviderLocked = Boolean(initialProviderId || editingIntegration);

  const theme =
    PROVIDER_THEMES[resolvedProviderKey] ||
    PROVIDER_THEMES[activeProvider.id.toUpperCase()] ||
    PROVIDER_THEMES[selectedProviderId.toUpperCase()] || {
      bg: 'bg-cyan-600/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/20',
      text: 'text-cyan-600 dark:text-cyan-400',
      badge: activeProvider.displayName,
      iconLetter: activeProvider.displayName.charAt(0),
    };

  const handleProviderChange = (newId: string) => {
    const pid = resolveProviderId(newId);
    setSelectedProviderId(pid);
    const p =
      DEFAULT_PROVIDERS.find((pr) => resolveProviderId(pr.id) === pid) ||
      providers.find((pr) => resolveProviderId(pr.id) === pid);
    if (p && !editingIntegration) {
      setName(`${p.displayName} Muhasebe`);
      const defaultCreds: Record<string, string> = {};
      p.credentialSchema?.fields?.forEach((f) => {
        if (f.defaultValue) defaultCreds[f.key] = f.defaultValue;
      });
      setCredentials(defaultCreds);
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
          provider: resolvedProviderKey,
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

            {/* Sage Business Cloud Accounting Guidance (§1, §4, §6) */}
            {isSage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100">
                  <InformationCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Sage Business Cloud Accounting Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300">
                  <li><strong>Bölgesel Model:</strong> Sage İngiltere ve Avrupa odaklıdır. Türk vergi / e-Fatura modeli uygulanmaz.</li>
                  <li><strong>Zorunlu Yapılandırma (§6):</strong> Fatura gönderimi için Varsayılan Gelir Hesabı ve Vergi Oranı seçilmelidir.</li>
                  <li><strong>Dönen Refresh Token (§4.1):</strong> Her token kullanımında rotasyon uygulanır ve sunucu tarafında güvenli saklanır.</li>
                </ul>
              </div>
            )}

            {/* Xero Accounting API Guidance */}
            {isXero && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 p-4 text-xs text-sky-900 dark:text-sky-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-950 dark:text-sky-100">
                  <InformationCircleIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  Xero Accounting API Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-sky-800 dark:text-sky-300">
                  <li><strong>Küresel Model:</strong> Xero uluslararası bulut muhasebe standardını kullanır (Yeni Zelanda, İngiltere, ABD, Avustralya). Türk e-Fatura / GİB zorunluluğu yoktur.</li>
                  <li><strong>3 Adımlı Mutabakat Akışı:</strong> Faturalar önce DRAFT olarak oluşturulur, sunucu hesaplamalı toplamlar mutabakat toleransı (≤ 0.05) içinde doğrulanıp AUTHORISED statüsüne alınır.</li>
                  <li><strong>Dönen Refresh Token:</strong> Token rotasyonu 30 dakikalık tolerans (grace period) ile çalışır, 60 günlük hareketsizlik sonlanmasına karşı haftalık otomatik canlı tutma tetiklenir.</li>
                </ul>
              </div>
            )}

            {/* Re-authorization required warning banner */}
            {isReauthRequired && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-950 dark:text-rose-100">Yeniden Yetkilendirme Gerekli:</span>
                    <p className="mt-0.5 text-rose-800 dark:text-rose-300">
                      {isXero ? 'Xero' : 'Sage'} refresh token süresi dolmuş veya geçersiz kalmıştır. Lütfen &quot;{isXero ? 'Xero' : 'Sage'} ile Yeniden Bağlan&quot; düğmesine basarak oturumunuzu tazeleyin.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={isStartingOAuth}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-all shadow-sm"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                  {isXero ? 'Xero' : 'Sage'} ile Yeniden Bağlan
                </button>
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
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {activeProvider.displayName} Bağlantı Bilgileri
                  </h3>
                  <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                    {activeProvider.displayName} panelinizden temin ettiğiniz API erişim bilgilerini girin.
                  </p>
                </div>

                {isDynamics && editingIntegration?.id && (
                  <button
                    type="button"
                    onClick={handleDiscoverDynamicsCompanies}
                    disabled={isDiscoveringDynamics}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-all"
                  >
                    <ArrowPathIcon className={`h-3.5 w-3.5 ${isDiscoveringDynamics ? 'animate-spin' : ''}`} />
                    Şirketleri Çek
                  </button>
                )}
              </div>

              {/* Dynamics Discovered Companies Chips */}
              {isDynamics && discoveredDynamicsCompanies.length > 0 && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 space-y-2">
                  <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-200">
                    Kayıtlı Business Central Şirketleri (Seçmek için tıklayın):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {discoveredDynamicsCompanies.map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => handleCredentialChange('companyId', comp.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                          credentials.companyId === comp.id
                            ? 'bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-400'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600'
                        }`}
                      >
                        {comp.name} ({comp.id.substring(0, 8)}...)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeProvider.credentialSchema?.fields?.map((field) => {
                  const isSecret = field.type === 'password' || field.secret;
                  const currentValue = credentials[field.key] || '';
                  return (
                    <div
                      key={field.key}
                      className={field.type === 'url' ? 'col-span-full space-y-1' : 'space-y-1'}
                    >
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {field.label} {field.required ? <span className="text-red-500">*</span> : ''}
                        </label>

                        {/* Dynamics quick helpers */}
                        {isDynamics && field.key === 'environmentName' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCredentialChange('environmentName', 'production')}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${
                                currentValue === 'production'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20'
                              }`}
                            >
                              production
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCredentialChange('environmentName', 'sandbox')}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${
                                currentValue === 'sandbox'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20'
                              }`}
                            >
                              sandbox
                            </button>
                          </div>
                        )}

                        {isDynamics && field.key === 'companyId' && !currentValue && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCredentialChange(
                                'companyId',
                                'b0a00001-0000-0000-0000-000000000001',
                              )
                            }
                            className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline px-1.5 py-0.5 rounded bg-cyan-500/10 font-medium"
                          >
                            Örnek GUID Doldur
                          </button>
                        )}
                      </div>

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
                      {field.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {field.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sage OAuth & Token Status (§5 & §10) */}
            {isSage && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Sage OAuth2 Tarayıcı Yetkilendirmesi
                    </h3>
                    <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Tarayıcı yönlendirmesiyle Sage hesabınızda KroptOS oturumunu açıp yetki verin.
                    </p>
                  </div>
                  {editingIntegration?.id ? (
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      disabled={isStartingOAuth}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-xs"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                      Sage ile Bağlan / Yetkilendir
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Entegrasyonu kaydettikten sonra bağlanabilirsiniz.
                    </span>
                  )}
                </div>

                {editingIntegration?.lastVerifiedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                    <span>
                      Son Token / Doğrulama Zamanı:{' '}
                      <strong>{new Date(editingIntegration.lastVerifiedAt).toLocaleString('tr-TR')}</strong>
                    </span>
                  </div>
                )}

                {/* Configuration Discovery Helpers (§6) */}
                {editingIntegration?.id && (
                  <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Sage Yapılandırma Keşfi (Hesap Planı ve Vergiler)
                      </span>
                      <button
                        type="button"
                        onClick={handleDiscoverConfig}
                        disabled={isDiscovering}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                        Yapılandırmayı Çek
                      </button>
                    </div>

                    {discoveredBusinesses.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Mevcut İşletmeler:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredBusinesses.map((b: any) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleCredentialChange('businessId', b.id)}
                              className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200"
                            >
                              {b.name || b.displayed_as} ({b.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {discoveredAccounts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Gelir Hesapları (Ledger Accounts):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredAccounts.map((a: any) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => handleCredentialChange('defaultLedgerAccountId', a.id)}
                              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                            >
                              {a.displayed_as || a.name} ({a.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {discoveredTaxRates.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Vergi Oranları (Tax Rates):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredTaxRates.map((tr: any) => (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() => handleCredentialChange('defaultTaxRateId', tr.id)}
                              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                            >
                              {tr.displayed_as || tr.name} ({tr.percentage}%)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Xero OAuth & Organization Selection */}
            {isXero && (
              <div className="rounded-2xl border border-sky-500/20 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-500/20 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      Xero OAuth2 Tarayıcı Yetkilendirmesi
                    </h3>
                    <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Tarayıcı yönlendirmesiyle Xero hesabınızda KroptOS oturumunu açıp yetki verin ve bağlı organizasyonu seçin.
                    </p>
                  </div>
                  {editingIntegration?.id ? (
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      disabled={isStartingOAuth}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition-all shadow-xs"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                      Xero ile Bağlan / Yetkilendir
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Entegrasyonu kaydettikten sonra bağlanabilirsiniz.
                    </span>
                  )}
                </div>

                {editingIntegration?.lastVerifiedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <ShieldCheckIcon className="h-4 w-4 text-sky-600" />
                    <span>
                      Son Token / Doğrulama Zamanı:{' '}
                      <strong>{new Date(editingIntegration.lastVerifiedAt).toLocaleString('tr-TR')}</strong>
                    </span>
                  </div>
                )}

                {/* Organization Discovery */}
                {editingIntegration?.id && (
                  <div className="pt-2 border-t border-sky-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Xero Organizasyonları / Kuruluşları
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsDiscovering(true);
                          try {
                            const data = await api.get<any[]>(
                              `/accounting/integrations/${editingIntegration.id}/businesses`,
                            );
                            setDiscoveredBusinesses(data || []);
                            toast.success('Xero organizasyon listesi güncellendi.');
                          } catch (err: any) {
                            toast.error(err.message || 'Organizasyon listesi alınamadı.');
                          } finally {
                            setIsDiscovering(false);
                          }
                        }}
                        disabled={isDiscovering}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                        Organizasyonları Çek
                      </button>
                    </div>

                    {discoveredBusinesses.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Mevcut Organizasyonlar:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredBusinesses.map((b: any) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                handleCredentialChange('tenantId', b.id);
                                if (b.name) handleCredentialChange('tenantName', b.name);
                              }}
                              className="rounded-lg bg-sky-100 dark:bg-sky-900/40 px-2 py-1 text-[11px] font-medium text-sky-800 dark:text-sky-200 hover:bg-sky-200"
                            >
                              {b.name} ({b.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
