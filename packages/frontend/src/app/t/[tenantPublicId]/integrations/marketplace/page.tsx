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
  FolderIcon
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';
import CategoryMappingModal from './components/CategoryMappingModal';

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
}

export default function MarketplacePage() {
  const { tenantContext } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
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
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal States
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Testing & Sync states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [mappingIntegration, setMappingIntegration] = useState<Integration | null>(null);

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

  const handleOpenCreate = () => {
    setEditingIntegration(null);
    setFormData({
      name: '',
      provider: 'trendyol',
      apiKey: '',
      apiSecret: '',
      sellerId: '',
      merchantId: '',
      awsAccessKey: '',
      awsSecretKey: '',
      refreshToken: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormData({
      name: integration.name || '',
      provider: integration.provider || 'trendyol',
      apiKey: '',
      apiSecret: '',
      sellerId: '',
      merchantId: '',
      awsAccessKey: '',
      awsSecretKey: '',
      refreshToken: '',
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
      if (editingIntegration) {
        // Update integration name & credentials if provided
        const payload: any = { name: formData.name };
        const credentialsPayload: any = {};
        if (formData.apiKey) credentialsPayload.apiKey = formData.apiKey;
        if (formData.apiSecret) credentialsPayload.apiSecret = formData.apiSecret;
        if (formData.sellerId) credentialsPayload.sellerId = formData.sellerId;
        if (formData.merchantId) credentialsPayload.merchantId = formData.merchantId;
        if (formData.awsAccessKey) credentialsPayload.awsAccessKey = formData.awsAccessKey;
        if (formData.awsSecretKey) credentialsPayload.awsSecretKey = formData.awsSecretKey;
        if (formData.refreshToken) credentialsPayload.refreshToken = formData.refreshToken;

        if (Object.keys(credentialsPayload).length > 0) {
          payload.credentials = credentialsPayload;
        }

        const updated = await apiFetch<Integration>(`/integrations/${editingIntegration.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setIntegrations(integrations.map(item => item.id === editingIntegration.id ? updated : item));
      } else {
        // Create integration
        const credentialsPayload: any = {};
        const p = formData.provider.toUpperCase();
        if (p === 'TRENDYOL') {
          credentialsPayload.apiKey = formData.apiKey;
          credentialsPayload.apiSecret = formData.apiSecret;
          credentialsPayload.sellerId = formData.sellerId;
        } else if (p === 'HEPSIBURADA') {
          credentialsPayload.apiKey = formData.apiKey;
          credentialsPayload.apiSecret = formData.apiSecret;
          credentialsPayload.merchantId = formData.merchantId;
        } else if (p === 'AMAZON') {
          credentialsPayload.sellerId = formData.sellerId;
          credentialsPayload.awsAccessKey = formData.awsAccessKey;
          credentialsPayload.awsSecretKey = formData.awsSecretKey;
          credentialsPayload.refreshToken = formData.refreshToken;
        } else if (p === 'N11') {
          credentialsPayload.apiKey = formData.apiKey;
          credentialsPayload.apiSecret = formData.apiSecret;
        } else if (p === 'CICEKSEPETI') {
          credentialsPayload.apiKey = formData.apiKey;
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
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during submission');
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
      setIntegrations(integrations.filter(item => item.id !== integrationToDelete.id));
      setIntegrationToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete integration');
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
        alert('Connection test success! Credentials validated.');
        // Refresh status
        fetchIntegrations();
      } else {
        alert(`Connection test failed: ${res.message}`);
        fetchIntegrations();
      }
    } catch (err: any) {
      alert(err.message || 'Error testing connection');
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
        alert('Catalog sync job successfully enqueued in background worker queue!');
        fetchIntegrations();
      } else {
        alert(`Sync failed: ${res.message}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error triggering sync');
    } finally {
      setSyncingId(null);
    }
  };

  if (!tenantContext.agencyId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <LinkIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Agency Context Required</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          Please select an active Agency context to view marketplace integrations.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading integrations...</p>
      </div>
    );
  }

  const renderCredentialsFields = () => {
    const provider = formData.provider.toLowerCase();

    if (provider === 'trendyol') {
      return (
        <>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Key {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="e.g. key-abc123xyz"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Secret {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="password"
              required={!editingIntegration}
              value={formData.apiSecret}
              onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              Seller ID {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.sellerId}
              onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
              placeholder="e.g. 123456"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
        </>
      );
    }

    if (provider === 'hepsiburada') {
      return (
        <>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Key {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="e.g. key-abc123xyz"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Secret {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="password"
              required={!editingIntegration}
              value={formData.apiSecret}
              onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              Merchant ID {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.merchantId}
              onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
              placeholder="e.g. merchant-123"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
        </>
      );
    }

    if (provider === 'amazon') {
      return (
        <>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              Seller ID {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.sellerId}
              onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
              placeholder="e.g. A3XXXXXXXXXXXX"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              AWS Access Key {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.awsAccessKey}
              onChange={(e) => setFormData({ ...formData, awsAccessKey: e.target.value })}
              placeholder="e.g. AKIAXXXXXXXXXXXXXXXX"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              AWS Secret Key {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="password"
              required={!editingIntegration}
              value={formData.awsSecretKey}
              onChange={(e) => setFormData({ ...formData, awsSecretKey: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              SP-API Refresh Token {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="password"
              required={!editingIntegration}
              value={formData.refreshToken}
              onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
              placeholder="Atzr|..."
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
        </>
      );
    }

    if (provider === 'n11') {
      return (
        <>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Key {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="e.g. key-abc123xyz"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Secret {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="password"
              required={!editingIntegration}
              value={formData.apiSecret}
              onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
        </>
      );
    }

    if (provider === 'ciceksepeti') {
      return (
        <>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
              API Key (x-api-key) {editingIntegration && '(Leave blank to keep unchanged)'} *
            </label>
            <input
              type="text"
              required={!editingIntegration}
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="e.g. ciceksepeti-key-123"
              className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
            />
          </div>
        </>
      );
    }

    return null;
  };

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Failed to load integrations</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
        <button
          onClick={fetchIntegrations}
          className="mt-4 flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-medium text-white hover:bg-kp-accent-hover transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-kp-border pb-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <LinkIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-kp-text-primary">Marketplace Integrations</h1>
            <p className="text-xs text-kp-text-tertiary">Connect and manage marketplaces like Trendyol, Hepsiburada, and Amazon</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
        >
          <PlusIcon className="h-4 w-4" /> Add Integration
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Synced</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {integrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-kp-text-tertiary">
                    No marketplace integrations configured for the current context. Click "Add Integration" to connect one.
                  </td>
                </tr>
              ) : (
                integrations.map((item) => (
                  <tr key={item.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-kp-text-primary uppercase">{item.provider}</td>
                    <td className="py-3.5 px-4">{item.name}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={
                          item.status === 'error' || item.status === 'failed'
                            ? 'error'
                            : item.status === 'warning'
                            ? 'warning'
                            : 'active'
                        }
                        label={item.status}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-kp-text-tertiary">
                      {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleTriggerSync(item.id)}
                          disabled={syncingId === item.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-kp-md border border-kp-border text-xs text-kp-text-secondary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                        >
                          {syncingId === item.id ? <ArrowPathIcon className="h-3 w-3 animate-spin" /> : <CheckCircleIcon className="h-3 w-3" />}
                          Sync
                        </button>
                        <button
                          onClick={() => handleTestConnection(item.id)}
                          disabled={testingId === item.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-kp-md border border-kp-border text-xs text-kp-text-secondary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                        >
                          {testingId === item.id ? <ArrowPathIcon className="h-3 w-3 animate-spin" /> : <LinkIcon className="h-3 w-3" />}
                          Test
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setIntegrationToDelete(item)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-danger hover:bg-kp-bg-hover transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
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

      {/* CREATE & EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary">
                {editingIntegration ? 'Edit Integration Settings' : 'Add Marketplace Integration'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="flex gap-2 p-3 text-xs border rounded-kp-md bg-kp-danger/10 border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Friendly Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Trendyol Turkey Shop"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  {!editingIntegration && (
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                        Marketplace Provider
                      </label>
                      <select
                        value={formData.provider}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      >
                        <option value="trendyol">Trendyol</option>
                        <option value="hepsiburada">Hepsiburada</option>
                        <option value="amazon">Amazon</option>
                        <option value="n11">N11</option>
                        <option value="ciceksepeti">ÇiçekSepeti</option>
                      </select>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-kp-border pt-4">
                    <h4 className="text-xs font-semibold text-kp-text-primary mb-3">API Credentials</h4>
                  </div>
                  {renderCredentialsFields()}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
                >
                  {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {editingIntegration ? 'Save Changes' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {integrationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> Delete Integration
              </h3>
              <button
                onClick={() => setIntegrationToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-theme-sm text-kp-text-secondary">
                Are you sure you want to delete integration <span className="font-semibold text-kp-text-primary">{integrationToDelete.name}</span>? This will permanently erase API authentication links.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setIntegrationToDelete(null)}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
              >
                {isDeleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
