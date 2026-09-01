'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon } from '@heroicons/react/24/outline';
import { IntegrationTree } from './components/IntegrationTree';
import { AddIntegrationModal, CatalogProvider } from './components/AddIntegrationModal';
import { ActiveIntegrationsTable, ActiveIntegrationItem } from './components/ActiveIntegrationsTable';
import { IntegrationSettingsDrawer } from './marketplace/components/IntegrationSettingsDrawer';
import { IntegrationSetupWizard } from './marketplace/components/IntegrationSetupWizard';
import CarrierConnectionDrawer from './carrier/components/CarrierConnectionDrawer';
import { CarrierSetupWizard } from './carrier/components/CarrierSetupWizard';
import type { CarrierConnection, CarrierProviderOption } from './carrier/types';

export default function IntegrationsParentPage() {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<ActiveIntegrationItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Carrier Drawer & Wizard State
  const [carrierConnections, setCarrierConnections] = useState<CarrierConnection[]>([]);
  const [carrierProviders, setCarrierProviders] = useState<CarrierProviderOption[]>([]);
  const [activeCarrierConnection, setActiveCarrierConnection] = useState<CarrierConnection | null>(null);
  const [isCarrierDrawerOpen, setIsCarrierDrawerOpen] = useState(false);
  const [carrierSetupProvider, setCarrierSetupProvider] = useState<{
    option: CarrierProviderOption;
    presetName: string;
  } | null>(null);

  // Marketplace Drawer / Wizard State
  const [activeDrawerIntegration, setActiveDrawerIntegration] = useState<any>(null);
  const [wizardProvider, setWizardProvider] = useState<CatalogProvider | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      const [marketplaces, carriers, providerOptions] = await Promise.all([
        apiFetch<any[]>('/integrations').catch(() => []),
        apiFetch<CarrierConnection[]>('/carriers').catch(() => []),
        apiFetch<CarrierProviderOption[]>('/carriers/providers').catch(() => []),
      ]);

      const rawCarriers = carriers || [];
      setCarrierConnections(rawCarriers);
      setCarrierProviders(providerOptions || []);

      const carrierItems: ActiveIntegrationItem[] = rawCarriers.map((c) => ({
        id: c.id,
        name: c.displayName,
        provider: c.provider,
        providerType: 'carrier',
        status: c.isActive ? 'active' : 'inactive',
        lastSyncAt: c.lastTestedAt ?? undefined,
        isCarrier: true,
        rawCarrier: c,
      }));

      setIntegrations([...(marketplaces || []), ...carrierItems]);
    } catch (err) {
      console.error('Failed to fetch integrations', err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleSelectProvider = (provider: CatalogProvider) => {
    if (provider.category === 'carrier') {
      const existingCarrier = carrierConnections.find(
        (c) => c.provider.toLowerCase() === provider.id.toLowerCase(),
      );
      if (existingCarrier) {
        // Connected -> Open Settings Drawer directly
        setActiveCarrierConnection(existingCarrier);
        setIsCarrierDrawerOpen(true);
      } else {
        // Not connected -> Open Setup Wizard Modal in center
        const option = carrierProviders.find(
          (p) => p.provider.toLowerCase() === provider.id.toLowerCase(),
        );
        const CARRIER_REQUIRED_FIELDS_MAP: Record<string, { name: string; secret: boolean }[]> = {
          gls: [{ name: 'username', secret: false }, { name: 'password', secret: true }, { name: 'shipperId', secret: false }],
          ups: [{ name: 'clientId', secret: false }, { name: 'clientSecret', secret: true }, { name: 'accountNumber', secret: false }],
          fedex: [{ name: 'apiKey', secret: false }, { name: 'secretKey', secret: true }, { name: 'accountNumber', secret: false }],
          inpost: [{ name: 'apiToken', secret: true }, { name: 'organizationId', secret: false }],
          postnl: [{ name: 'apiKey', secret: true }, { name: 'customerCode', secret: false }, { name: 'customerNumber', secret: false }],
          royal_mail: [{ name: 'apiKey', secret: true }],
          evri: [{ name: 'apiKey', secret: true }, { name: 'apiSecret', secret: true }, { name: 'clientId', secret: false }, { name: 'clientSecret', secret: true }],
          colissimo: [{ name: 'contractNumber', secret: false }, { name: 'password', secret: true }, { name: 'apiKey', secret: true }],
          chronopost: [{ name: 'accountNumber', secret: false }, { name: 'password', secret: true }],
          sameday: [{ name: 'username', secret: false }, { name: 'password', secret: true }],
          fan_courier: [{ name: 'clientId', secret: false }, { name: 'username', secret: false }, { name: 'password', secret: true }],
          cargus: [{ name: 'subscriptionKey', secret: true }, { name: 'username', secret: false }, { name: 'password', secret: true }],
          packeta: [{ name: 'apiKey', secret: false }, { name: 'apiSecret', secret: true }, { name: 'eshop', secret: false }],
          yurtici: [{ name: 'wsUserName', secret: false }, { name: 'wsPassword', secret: true }],
          aras: [{ name: 'userName', secret: false }, { name: 'password', secret: true }, { name: 'customerCode', secret: false }],
          surat: [{ name: 'userName', secret: false }, { name: 'password', secret: true }, { name: 'customerCode', secret: false }],
          ptt: [{ name: 'username', secret: false }, { name: 'password', secret: true }, { name: 'customerCode', secret: false }],
          mng: [{ name: 'customerNumber', secret: false }, { name: 'username', secret: false }, { name: 'password', secret: true }],
          dhl: [{ name: 'apiKey', secret: true }, { name: 'apiSecret', secret: true }, { name: 'accountNumber', secret: false }],
          dpd: [{ name: 'apiKey', secret: true }, { name: 'accountNumber', secret: false }],
          sendeo: [{ name: 'username', secret: false }, { name: 'password', secret: true }, { name: 'customerCode', secret: false }],
          hepsijet: [{ name: 'userName', secret: false }, { name: 'password', secret: true }, { name: 'companyShortName', secret: false }],
        };

        const fallbackOption: CarrierProviderOption = option || {
          provider: provider.id.toUpperCase(),
          requiredFields: CARRIER_REQUIRED_FIELDS_MAP[provider.id.toLowerCase()] || [],
        };
        setCarrierSetupProvider({ option: fallbackOption, presetName: provider.name });
      }
      return;
    }

    const existing = integrations.find(
      (i) => !i.isCarrier && i.provider.toLowerCase() === provider.id.toLowerCase(),
    );
    if (existing) {
      setActiveDrawerIntegration(existing);
    } else {
      setWizardProvider(provider);
    }
  };

  const handleOpenSettings = (item: ActiveIntegrationItem) => {
    if (item.isCarrier) {
      setActiveCarrierConnection(item.rawCarrier);
      setIsCarrierDrawerOpen(true);
    } else {
      setActiveDrawerIntegration(item);
    }
  };

  const handleSync = async (id: string) => {
    const item = integrations.find((i) => i.id === id);
    setSyncingId(id);
    try {
      if (item?.isCarrier) {
        const res = await apiFetch<any>(`/carriers/${id}/test`, { method: 'POST' });
        if (res.success) {
          toast.success(res.message || 'Kargo bağlantı testi başarılı');
        } else {
          toast.error(res.message || 'Kargo bağlantı testi başarısız');
        }
        await fetchIntegrations();
        window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
      } else {
        const res = await apiFetch<any>(`/integrations/${id}/sync`, { method: 'POST' });
        if (res.success) {
          if (res.mode === 'simulation') {
            toast.warning(res.message, 9000);
          } else {
            toast.success('Senkronizasyon başlatıldı');
          }
          fetchIntegrations();
          window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
        } else {
          toast.error(res.message || 'Senkronizasyon başarısız oldu');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'İşlem sırasında hata oluştu');
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleStatus = async (item: ActiveIntegrationItem) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    setTogglingId(item.id);
    try {
      if (item.isCarrier) {
        await apiFetch(`/carriers/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: nextStatus === 'active' }),
        });
        toast.success(
          nextStatus === 'active'
            ? `${item.name} kargo bağlantısı aktifleştirildi`
            : `${item.name} kargo bağlantısı pasifleştirildi`,
        );
      } else {
        await apiFetch(`/integrations/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        toast.success(
          nextStatus === 'active'
            ? `${item.name} aktifleştirildi`
            : `${item.name} pasifleştirildi, senkronizasyon durduruldu`,
        );
      }
      await fetchIntegrations();
      window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
    } catch (err: any) {
      toast.error(err.message || 'Entegrasyon durumu güncellenemedi');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu entegrasyonu kaldırmak istediğinizden emin misiniz?')) return;
    const item = integrations.find((i) => i.id === id);
    try {
      if (item?.isCarrier) {
        await apiFetch(`/carriers/${id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/integrations/${id}`, { method: 'DELETE' });
      }
      toast.success('Entegrasyon silindi');
      fetchIntegrations();
      window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
    } catch (err: any) {
      toast.error(err.message || 'Entegrasyon silinirken hata oluştu');
    }
  };

  const connectedProviderIds = integrations.map((i) => i.provider.toLowerCase());

  return (
    <div className="flex flex-col h-full animate-fade-in p-6 space-y-6">
      {/* Visual Integration Tree Schema Map */}
      <IntegrationTree />

      {/* Action Bar Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-2xl border border-indigo-500 text-white shadow-lg">
        <div className="space-y-1">
          <h1 className="text-base font-bold">Entegrasyon Merkezi</h1>
          <p className="text-xs text-blue-100">
            Sisteme bağlı aktif entegrasyonlarınızı yönetin veya yeni entegrasyon ekleyin.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-indigo-700 px-6 py-3 text-sm font-bold shadow-lg shadow-black/10 transition-all hover:scale-105 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5 stroke-[3]" />
          <span>Entegrasyon Ekle</span>
        </button>
      </div>

      {/* Active Integrations Management Table */}
      <ActiveIntegrationsTable
        items={integrations}
        onOpenSettings={handleOpenSettings}
        onSync={handleSync}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        syncingId={syncingId}
        togglingId={togglingId}
      />

      {/* Add Integration Catalog Search Modal */}
      <AddIntegrationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        connectedProviderIds={connectedProviderIds}
        onSelectProvider={handleSelectProvider}
      />

      {/* Marketplace Settings Drawer */}
      {activeDrawerIntegration && (
        <IntegrationSettingsDrawer
          integrationId={activeDrawerIntegration.id}
          integrationName={activeDrawerIntegration.name}
          status={activeDrawerIntegration.status}
          onClose={() => {
            setActiveDrawerIntegration(null);
            fetchIntegrations();
            window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
          }}
        />
      )}

      {/* Carrier Connection Settings Drawer */}
      {isCarrierDrawerOpen && (
        <CarrierConnectionDrawer
          connection={activeCarrierConnection}
          providers={carrierProviders}
          onClose={() => {
            setIsCarrierDrawerOpen(false);
            setActiveCarrierConnection(null);
          }}
          onSaved={() => {
            setIsCarrierDrawerOpen(false);
            setActiveCarrierConnection(null);
            fetchIntegrations();
            window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
          }}
        />
      )}

      {/* Carrier Setup Wizard Center Modal */}
      {carrierSetupProvider && (
        <CarrierSetupWizard
          provider={carrierSetupProvider.option}
          presetName={carrierSetupProvider.presetName}
          onClose={() => setCarrierSetupProvider(null)}
          onCreated={(createdCarrier) => {
            setCarrierSetupProvider(null);
            fetchIntegrations();
            window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
            // Seamlessly open Settings Drawer for the newly created carrier connection
            setActiveCarrierConnection(createdCarrier);
            setIsCarrierDrawerOpen(true);
          }}
        />
      )}

      {/* Marketplace Setup Wizard Modal */}
      {wizardProvider && (
        <IntegrationSetupWizard
          provider={wizardProvider.id}
          presetName={wizardProvider.name}
          onClose={() => setWizardProvider(null)}
          onCreated={() => {
            fetchIntegrations();
            window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
          }}
          onFinished={() => {
            setWizardProvider(null);
            fetchIntegrations();
            window.dispatchEvent(new CustomEvent('refresh-integration-tree'));
          }}
        />
      )}
    </div>
  );
}
