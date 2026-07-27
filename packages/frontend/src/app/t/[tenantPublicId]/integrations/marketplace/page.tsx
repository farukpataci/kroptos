'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import {
  LinkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';

interface Integration {
  id: string;
  agencyId: string;
  clientId?: string;
  storeId?: string;
  provider: string;
  providerType: string;
  name: string;
  status: string;
  lastSyncAt?: string;
  createdAt: string;
  credentials?: any;
}

interface MarketplacePreset {
  id: string;
  name: string;
  provider: string;
  desc: string;
  badgeBg: string;
  badgeText: string;
}

const MARKETPLACE_PRESETS: MarketplacePreset[] = [
  {
    id: 'trendyol',
    name: 'Trendyol Entegrasyonu',
    provider: 'trendyol',
    desc: "Türkiye'nin lider pazaryeri Trendyol sipariş, ürün ve anlık stok senkronizasyonu.",
    badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    badgeText: 'TRENDYOL',
  },
  {
    id: 'hepsiburada',
    name: 'Hepsiburada Entegrasyonu',
    provider: 'hepsiburada',
    desc: 'Hepsiburada Merchant API ile otomatik ürün listeleme ve çift yönlü stok aktarımı.',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
    badgeText: 'HEPSİBURADA',
  },
  {
    id: 'amazon',
    name: 'Amazon Seller Central',
    provider: 'amazon',
    desc: 'Amazon SP-API altyapısı ile küresel ve yerel Amazon mağaza stok takibi.',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    badgeText: 'AMAZON',
  },
  {
    id: 'n11',
    name: 'N11 Pazaryeri Entegrasyonu',
    provider: 'n11',
    desc: 'N11 REST API ile anlık kategori eşleştirme, fiyat ve stok senkronizasyonu.',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-600',
    badgeText: 'N11',
  },
  {
    id: 'ciceksepeti',
    name: 'Çiçeksepeti Entegrasyonu',
    provider: 'ciceksepeti',
    desc: 'Çiçeksepeti pazaryeri mağaza bağlantısı, ürün güncellemeleri ve sipariş yönetimi.',
    badgeBg: 'bg-pink-500/10 border-pink-500/20 text-pink-600',
    badgeText: 'ÇİÇEKSEPETİ',
  },
  {
    id: 'shopify',
    name: 'Shopify E-Ticaret Mağazası',
    provider: 'shopify',
    desc: 'Shopify e-ticaret siteniz ile çift yönlü canlı stok ve envanter eşitlemesi.',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    badgeText: 'SHOPIFY',
  },
  {
    id: 'pazarama',
    name: 'Pazarama Entegrasyonu',
    provider: 'pazarama',
    desc: 'Pazarama pazaryeri mağaza stok, fiyat ve sipariş entegrasyonu.',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    badgeText: 'PAZARAMA',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce Mağaza',
    provider: 'woocommerce',
    desc: 'WordPress WooCommerce e-ticaret siteniz ile canlı stok ve sipariş akışı.',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-600',
    badgeText: 'WOOCOMMERCE',
  },
];

export default function MarketplacePage() {
  const toast = useToast();
  const { tenantContext } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<MarketplacePreset | null>(null);
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    provider: 'trendyol',
    apiKey: '',
    apiSecret: '',
    sellerId: '',
    merchantId: '',
    awsAccessKey: '',
    awsSecretKey: '',
    refreshToken: '',
    shopDomain: '',
    accessToken: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchIntegrations = async () => {
    if (!tenantContext.agencyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Integration[]>('/integrations');
      const filtered = (data || []).filter((item) => item.providerType === 'marketplace');
      setIntegrations(filtered);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch integrations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [tenantContext.agencyId, tenantContext.storeId]);

  const handleOpenConfigure = (preset: MarketplacePreset) => {
    setSelectedPreset(preset);
    const existing = integrations.find((i) => i.provider.toLowerCase() === preset.provider.toLowerCase());
    setActiveIntegration(existing || null);

    setFormData({
      name: existing?.name || preset.name,
      provider: preset.provider,
      apiKey: '',
      apiSecret: '',
      sellerId: '',
      merchantId: '',
      awsAccessKey: '',
      awsSecretKey: '',
      refreshToken: '',
      shopDomain: '',
      accessToken: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantContext.agencyId) {
      setFormError('Agency context is required');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (activeIntegration) {
        // Update existing integration
        const payload: any = { name: formData.name };
        const credentialsPayload: any = {};
        if (formData.apiKey) credentialsPayload.apiKey = formData.apiKey;
        if (formData.apiSecret) credentialsPayload.apiSecret = formData.apiSecret;
        if (formData.sellerId) credentialsPayload.sellerId = formData.sellerId;
        if (formData.merchantId) credentialsPayload.merchantId = formData.merchantId;
        if (formData.awsAccessKey) credentialsPayload.awsAccessKey = formData.awsAccessKey;
        if (formData.awsSecretKey) credentialsPayload.awsSecretKey = formData.awsSecretKey;
        if (formData.refreshToken) credentialsPayload.refreshToken = formData.refreshToken;
        if (formData.shopDomain) credentialsPayload.shopDomain = formData.shopDomain;
        if (formData.accessToken) credentialsPayload.accessToken = formData.accessToken;

        if (Object.keys(credentialsPayload).length > 0) {
          payload.credentials = credentialsPayload;
        }

        const updated = await apiFetch<Integration>(`/integrations/${activeIntegration.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setIntegrations(integrations.map((item) => (item.id === activeIntegration.id ? updated : item)));
        toast.success(`"${formData.name}" ayarları başarıyla güncellendi.`);
      } else {
        // Create new integration
        const credentialsPayload: any = {};
        const p = formData.provider.toLowerCase();
        if (p === 'trendyol') {
          credentialsPayload.apiKey = formData.apiKey;
          credentialsPayload.apiSecret = formData.apiSecret;
          credentialsPayload.sellerId = formData.sellerId;
        } else if (p === 'hepsiburada') {
          credentialsPayload.apiKey = formData.apiKey;
          credentialsPayload.apiSecret = formData.apiSecret;
          credentialsPayload.merchantId = formData.merchantId;
        } else if (p === 'amazon') {
          credentialsPayload.sellerId = formData.sellerId;
          credentialsPayload.awsAccessKey = formData.awsAccessKey;
          credentialsPayload.awsSecretKey = formData.awsSecretKey;
          credentialsPayload.refreshToken = formData.refreshToken;
        } else if (p === 'n11' || p === 'pazarama' || p === 'woocommerce') {
          credentialsPayload.apiKey = formData.apiKey;
          credentialsPayload.apiSecret = formData.apiSecret;
        } else if (p === 'ciceksepeti') {
          credentialsPayload.apiKey = formData.apiKey;
        } else if (p === 'shopify') {
          credentialsPayload.shopDomain = formData.shopDomain;
          credentialsPayload.accessToken = formData.accessToken;
        }

        const payload = {
          name: formData.name,
          provider: formData.provider,
          providerType: 'marketplace',
          agencyId: tenantContext.agencyId,
          clientId: tenantContext.clientId || undefined,
          storeId: tenantContext.storeId || undefined,
          credentials: credentialsPayload,
        };
        const created = await apiFetch<Integration>('/integrations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setIntegrations([created, ...integrations]);
        toast.success(`"${formData.name}" entegrasyonu başarıyla oluşturuldu.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!integrationToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/integrations/${integrationToDelete.id}`, {
        method: 'DELETE',
      });
      setIntegrations(integrations.filter((item) => item.id !== integrationToDelete.id));
      toast.success('Entegrasyon bağlantısı silindi.');
      setIntegrationToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Silme işlemi başarısız.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiFetch<any>(`/integrations/${id}/test-connection`, {
        method: 'POST',
      });
      if (res.success) {
        toast.success('API Bağlantı testi başarılı! Kimlik bilgileri doğrulandı.');
        fetchIntegrations();
      } else {
        toast.error(`Bağlantı testi başarısız: ${res.message}`);
        fetchIntegrations();
      }
    } catch (err: any) {
      toast.error(err.message || 'Bağlantı test edilirken hata oluştu.');
    } finally {
      setTestingId(null);
    }
  };

  const handleTriggerSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await apiFetch<any>(`/integrations/${id}/sync`, {
        method: 'POST',
      });
      if (res.success) {
        toast.success('Ürün ve stok senkronizasyonu başlatıldı!');
        fetchIntegrations();
      } else {
        toast.error(`Senkronizasyon başarısız: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Senkronizasyon hatası');
    } finally {
      setSyncingId(null);
    }
  };

  if (!tenantContext.agencyId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <LinkIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Ajans Bağlamı Gerekli</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          Pazaryeri entegrasyonlarını görüntülemek için lütfen aktif bir ajans seçin.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Entegrasyonlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-kp-border pb-4 pt-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <BuildingStorefrontIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-kp-text-primary">Pazaryeri Entegrasyonları (Marketplace Integrations)</h1>
            <p className="text-xs text-kp-text-tertiary">
              Trendyol, Hepsiburada, Amazon, N11 ve e-ticaret platformlarınızı entegre edin ve stoklarınızı otomatik yönetin.
            </p>
          </div>
        </div>

        <button
          onClick={fetchIntegrations}
          className="flex items-center gap-2 rounded-kp-md border border-kp-border px-3.5 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Grid Layout Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MARKETPLACE_PRESETS.map((preset) => {
          const connectedInt = integrations.find(
            (i) => i.provider.toLowerCase() === preset.provider.toLowerCase()
          );
          const isConnected = !!connectedInt;

          return (
            <div
              key={preset.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-kp-elevated ${
                isConnected
                  ? 'border-kp-accent bg-kp-accent/5 ring-1 ring-kp-accent'
                  : 'border-kp-border bg-kp-bg-secondary'
              }`}
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-kp-md border ${preset.badgeBg}`}>
                      {preset.badgeText}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-kp-bg-tertiary text-kp-text-tertiary border-kp-border'
                    }`}
                  >
                    {isConnected ? 'Bağlandı (Aktif)' : 'Bağlantı Yok'}
                  </span>
                </div>

                <h3 className="font-bold text-kp-text-primary text-base mb-1">
                  {connectedInt ? connectedInt.name : preset.name}
                </h3>

                <p className="text-xs text-kp-text-tertiary mb-6 leading-relaxed">
                  {preset.desc}
                </p>
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center gap-2 pt-3 border-t border-kp-border/60">
                <button
                  type="button"
                  onClick={() => handleOpenConfigure(preset)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-kp-md border transition-all ${
                    isConnected
                      ? 'bg-kp-accent border-kp-accent text-white shadow-xs'
                      : 'bg-kp-bg-primary border-kp-border text-kp-text-secondary hover:text-kp-accent hover:border-kp-accent'
                  }`}
                >
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                  <span>{isConnected ? 'Ayarlar' : 'Bağlantı Kur'}</span>
                </button>

                {isConnected && (
                  <>
                    <button
                      type="button"
                      disabled={testingId === connectedInt.id}
                      onClick={() => handleTestConnection(connectedInt.id)}
                      className="flex items-center gap-1 text-xs font-semibold py-2 px-2.5 rounded-kp-md border border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:text-kp-accent hover:border-kp-accent transition-colors disabled:opacity-50"
                      title="API Bağlantısını Test Et"
                    >
                      {testingId === connectedInt.id ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Test</span>
                    </button>

                    <button
                      type="button"
                      disabled={syncingId === connectedInt.id}
                      onClick={() => handleTriggerSync(connectedInt.id)}
                      className="flex items-center gap-1 text-xs font-semibold py-2 px-2.5 rounded-kp-md border border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:text-emerald-600 hover:border-emerald-500/40 transition-colors disabled:opacity-50"
                      title="Stok & Ürünleri Eşitle"
                    >
                      {syncingId === connectedInt.id ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Sync</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIntegrationToDelete(connectedInt)}
                      className="p-2 rounded-kp-md text-kp-text-tertiary hover:text-kp-danger hover:bg-kp-danger/10 transition-colors"
                      title="Bağlantıyı Sil"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* API Credentials Configuration Modal */}
      {isModalOpen && selectedPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-bg-primary/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                  <Cog6ToothIcon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-kp-text-primary">
                  {selectedPreset.name} API Ayarları
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="p-6 space-y-4 text-xs">
                {formError && (
                  <div className="flex gap-2 p-3 text-xs border rounded-kp-md bg-kp-danger/10 border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                    Entegrasyon Adı / Etiket *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="örn. Trendyol Mağazam"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>

                {/* Trendyol */}
                {selectedPreset.provider === 'trendyol' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Supplier ID / Satıcı ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.sellerId}
                        onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                        placeholder="123456"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        API Key *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="key-abc123xyz"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        API Secret *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.apiSecret}
                        onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                  </>
                )}

                {/* Hepsiburada */}
                {selectedPreset.provider === 'hepsiburada' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Merchant ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.merchantId}
                        onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                        placeholder="merchant-123"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        API Key *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="key-abc123xyz"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Secret Key *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.apiSecret}
                        onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                  </>
                )}

                {/* Amazon */}
                {selectedPreset.provider === 'amazon' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Seller ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.sellerId}
                        onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                        placeholder="A3XXXXXXXXXXXX"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        AWS Access Key *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.awsAccessKey}
                        onChange={(e) => setFormData({ ...formData, awsAccessKey: e.target.value })}
                        placeholder="AKIAXXXXXXXXXXXXXXXX"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        SP-API Refresh Token *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.refreshToken}
                        onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                        placeholder="Atzr|..."
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                  </>
                )}

                {/* N11, Pazarama, WooCommerce */}
                {(selectedPreset.provider === 'n11' || selectedPreset.provider === 'pazarama' || selectedPreset.provider === 'woocommerce') && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        API Key / Client ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="key-abc123xyz"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        API Secret / Client Secret *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.apiSecret}
                        onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                  </>
                )}

                {/* Çiçeksepeti */}
                {selectedPreset.provider === 'ciceksepeti' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      API Key (x-api-key) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="ciceksepeti-key-123"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                )}

                {/* Shopify */}
                {selectedPreset.provider === 'shopify' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Shopify Domain URL *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shopDomain}
                        onChange={(e) => setFormData({ ...formData, shopDomain: e.target.value })}
                        placeholder="magaza.myshopify.com"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Admin API Access Token *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.accessToken}
                        onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                        placeholder="shpat_••••••••••••••••"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Kaydet & Bağlan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {integrationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> Bağlantıyı Sil
              </h3>
              <button
                onClick={() => setIntegrationToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                <span className="font-bold text-kp-text-primary">{integrationToDelete.name}</span> pazaryeri entegrasyon bağlantısını silmek istediğinize emin misiniz? Bu işlem kayıtlı API kimlik bilgilerini temizleyecektir.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border text-xs">
              <button
                type="button"
                onClick={() => setIntegrationToDelete(null)}
                className="rounded-kp-md border border-kp-border px-4 py-2 font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 font-semibold shadow-xs transition-all"
              >
                {isDeleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
