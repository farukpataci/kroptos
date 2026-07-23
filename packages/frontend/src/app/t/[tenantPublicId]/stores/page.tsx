'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  BuildingStorefrontIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';

interface Store {
  id: string;
  agencyId: string;
  clientId?: string;
  name: string;
  slug: string;
  domain?: string;
  status: string;
  currency: string;
  locale: string;
  timezone: string;
  type: string;
  isActive: boolean;
}

export default function StoresPage() {
  const t = useTranslations('stores');
  const tc = useTranslations('common');
  const toast = useToast();
  const { tenantContext } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    status: 'active',
    currency: 'TRY',
    locale: 'tr-TR',
    timezone: 'Europe/Istanbul',
    type: 'retail',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal States
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStores = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Store[]>('/stores');
      setStores(data || []);
    } catch (err: any) {
      setError(err.message || t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantContext.agencyId) {
      fetchStores();
    } else {
      setIsLoading(false);
    }
  }, [tenantContext.agencyId]);

  const filteredStores = tenantContext.clientId
    ? stores.filter((s) => s.clientId === tenantContext.clientId)
    : stores;

  const handleOpenCreate = () => {
    setEditingStore(null);
    setFormData({
      name: '',
      domain: '',
      status: 'active',
      currency: 'TRY',
      locale: 'tr-TR',
      timezone: 'Europe/Istanbul',
      type: 'retail',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name || '',
      domain: store.domain || '',
      status: store.status || 'active',
      currency: store.currency || 'TRY',
      locale: store.locale || 'tr-TR',
      timezone: store.timezone || 'Europe/Istanbul',
      type: store.type || 'retail',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantContext.agencyId) {
      setFormError(t('agencyRequired.title'));
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingStore) {
        // Update store
        const updated = await apiFetch<Store>(`/stores/${editingStore.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
        setStores(stores.map(s => s.id === editingStore.id ? updated : s));
      } else {
        // Create store
        const payload = {
          ...formData,
          agencyId: tenantContext.agencyId,
          clientId: tenantContext.clientId || undefined,
        };
        const created = await apiFetch<Store>('/stores', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStores([created, ...stores]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || t('submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!storeToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/stores/${storeToDelete.id}`, {
        method: 'DELETE',
      });
      setStores(stores.filter(s => s.id !== storeToDelete.id));
      setStoreToDelete(null);
    } catch (err: any) {
      toast.error(err.message || t('deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!tenantContext.agencyId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <BuildingStorefrontIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">{t('agencyRequired.title')}</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          {t('agencyRequired.desc')}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">{t('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">{t('loadFailed')}</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
        <button
          onClick={fetchStores}
          className="mt-4 flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-medium text-white hover:bg-kp-accent-hover transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" /> {tc('actions.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <BuildingStorefrontIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-kp-text-primary">{t('title')}</h1>
            <p className="text-[13px] text-kp-text-tertiary">{t('subtitle')}</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
        >
          <PlusIcon className="h-4 w-4" /> {t('addStore')}
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
                <th className="py-3 px-4">{t('columns.name')}</th>
                <th className="py-3 px-4">{t('columns.slug')}</th>
                <th className="py-3 px-4">{t('columns.status')}</th>
                <th className="py-3 px-4">{t('columns.domain')}</th>
                <th className="py-3 px-4">{t('columns.currency')}</th>
                <th className="py-3 px-4 text-right">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-kp-text-tertiary">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-kp-text-primary">
                      <div>
                        <span>{store.name}</span>
                        <span className="ml-2 text-[10px] text-kp-text-tertiary uppercase tracking-wider bg-kp-bg-primary px-1.5 py-0.5 rounded-kp-md">
                          {store.type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[13px]">{store.slug}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={store.status === 'active' ? 'active' : store.status === 'suspended' ? 'error' : 'warning'} label={store.status} />
                    </td>
                    <td className="py-3.5 px-4">{store.domain || '-'}</td>
                    <td className="py-3.5 px-4 font-semibold text-kp-text-primary">{store.currency || 'USD'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(store)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                          title={tc('actions.edit')}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setStoreToDelete(store)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-danger hover:bg-kp-bg-hover transition-colors"
                          title={tc('actions.delete')}
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
                {editingStore ? t('modal.editTitle') : t('modal.createTitle')}
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
                      {t('modal.nameLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('modal.namePlaceholder')}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      {t('modal.domainLabel')}
                    </label>
                    <input
                      type="text"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="e.g. shop.nike.com"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      {t('modal.statusLabel')}
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="active">{t('modal.statusActive')}</option>
                      <option value="draft">{t('modal.statusDraft')}</option>
                      <option value="suspended">{t('modal.statusSuspended')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      {t('modal.currencyLabel')}
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      {t('modal.localeLabel')}
                    </label>
                    <select
                      value={formData.locale}
                      onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="tr-TR">{t('modal.localeTr')}</option>
                      <option value="en-US">{t('modal.localeEn')}</option>
                      <option value="de-DE">{t('modal.localeDe')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      {t('modal.timezoneLabel')}
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="Europe/Istanbul">Europe/Istanbul (TSİ)</option>
                      <option value="UTC">UTC</option>
                      <option value="Europe/London">Europe/London</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      {t('modal.typeLabel')}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    >
                      <option value="retail">{t('modal.typeRetail')}</option>
                      <option value="warehouse">{t('modal.typeWarehouse')}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  {tc('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
                >
                  {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {editingStore ? t('modal.saveChanges') : t('modal.createStore')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {storeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> {t('deleteModal.title')}
              </h3>
              <button
                onClick={() => setStoreToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-theme-sm text-kp-text-secondary">
                {t.rich('deleteModal.desc', {
                  name: storeToDelete.name,
                  b: (chunks) => <span className="font-semibold text-kp-text-primary">{chunks}</span>,
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setStoreToDelete(null)}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
              >
                {isDeleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                {tc('actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
