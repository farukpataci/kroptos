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

export default function IntegrationsParentPage() {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<ActiveIntegrationItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Drawer / Wizard State
  const [activeDrawerIntegration, setActiveDrawerIntegration] = useState<any>(null);
  const [wizardProvider, setWizardProvider] = useState<CatalogProvider | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      const data = await apiFetch<any[]>('/integrations');
      setIntegrations(data || []);
    } catch (err) {
      console.error('Failed to fetch integrations', err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleSelectProvider = (provider: CatalogProvider) => {
    // Check if an integration for this provider already exists
    const existing = integrations.find((i) => i.provider.toLowerCase() === provider.id.toLowerCase());
    if (existing) {
      setActiveDrawerIntegration(existing);
    } else {
      setWizardProvider(provider);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await apiFetch<any>(`/integrations/${id}/sync`, { method: 'POST' });
      if (res.success) {
        // A simulated run finishes with nothing imported, by design. Announcing
        // it as a plain success is how "0 sipariş" gets read as a broken
        // integration, so the mode decides which toast the user sees.
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
    } catch (err: any) {
      toast.error(err.message || 'Senkronizasyon sırasında hata oluştu');
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleStatus = async (item: ActiveIntegrationItem) => {
    // 'error' is a system state, not a user choice: turning the switch on from
    // there means "try again", so it maps to active like a passive row does.
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    setTogglingId(item.id);
    try {
      await apiFetch(`/integrations/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(
        nextStatus === 'active'
          ? `${item.name} aktifleştirildi`
          : `${item.name} pasifleştirildi, senkronizasyon durduruldu`,
      );
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
    try {
      await apiFetch(`/integrations/${id}`, { method: 'DELETE' });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl border border-slate-800 text-white shadow-lg">
        <div className="space-y-1">
          <h1 className="text-base font-bold">Entegrasyon Merkezi</h1>
          <p className="text-xs text-slate-400">
            Sisteme bağlı aktif entegrasyonlarınızı yönetin veya yeni entegrasyon ekleyin.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 whitespace-nowrap"
        >
          <PlusIcon className="h-4 w-4 stroke-[3]" />
          <span>Entegrasyon Ekle</span>
        </button>
      </div>

      {/* Active Integrations Management Table */}
      <ActiveIntegrationsTable
        items={integrations}
        onOpenSettings={(item) => setActiveDrawerIntegration(item)}
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

      {/* Settings Drawer */}
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

      {/* Setup Wizard Modal */}
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
