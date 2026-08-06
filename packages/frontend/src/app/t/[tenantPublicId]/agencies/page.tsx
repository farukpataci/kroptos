'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';

interface Agency {
  id: string;
  publicId?: string;
  name: string;
  slug: string;
  logo?: string | null;
  website?: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Distributor firms are the top of the tenant hierarchy, so this page is
 * reachable only by the platform administrator. The gate below is a courtesy —
 * the API refuses the writes regardless of what the UI renders.
 */
export default function AgenciesPage() {
  const t = useTranslations('agencies');
  const toast = useToast();
  const { user, tenantContext, switchTenant } = useAuth();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agency | null>(null);
  const [formData, setFormData] = useState({ name: '', website: '', isActive: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<Agency | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = user?.isPlatformAdmin === true;

  const fetchAgencies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Agency[]>('/agencies');
      setAgencies(data || []);
    } catch (err: any) {
      setError(err?.message || t('fetchError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) fetchAgencies();
    else setIsLoading(false);
  }, [canManage]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', website: '', isActive: true });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (agency: Agency) => {
    setEditing(agency);
    setFormData({
      name: agency.name,
      website: agency.website || '',
      isActive: agency.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const base = {
        name: formData.name,
        website: formData.website || undefined,
      };

      if (editing) {
        const updated = await apiFetch<Agency>(`/agencies/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...base, isActive: formData.isActive }),
        });
        setAgencies((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
        toast.success(t('toast.updated', { name: updated.name }));
      } else {
        // CreateAgencyDto has no isActive and the API rejects unknown fields;
        // a new firm starts active anyway.
        const created = await apiFetch<Agency>('/agencies', {
          method: 'POST',
          body: JSON.stringify(base),
        });
        setAgencies((prev) => [created, ...prev]);
        toast.success(t('toast.created', { name: created.name }));
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || t('toast.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/agencies/${toDelete.id}`, { method: 'DELETE' });
      setAgencies((prev) => prev.filter((a) => a.id !== toDelete.id));
      toast.success(t('toast.deleted'));
      setToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || t('toast.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <LockClosedIcon className="h-12 w-12 text-kp-text-tertiary" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">{t('denied.title')}</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-kp-text-tertiary">
          {t('denied.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-3 border-b border-kp-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <BuildingOffice2Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAgencies}
            className="flex items-center gap-2 rounded-kp-md border border-kp-border px-3.5 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover"
          >
            <PlusIcon className="h-4 w-4" />
            {t('actions.create')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 p-3 text-xs text-kp-danger">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <ArrowPathIcon className="h-6 w-6 animate-spin text-kp-accent" />
        </div>
      ) : agencies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-kp-border p-12 text-center">
          <BuildingOffice2Icon className="mx-auto h-10 w-10 text-kp-text-tertiary" />
          <p className="mt-3 text-xs text-kp-text-tertiary">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-kp-border bg-kp-bg-secondary">
          <div className="overflow-x-auto">
            <table className="kp-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-kp-border bg-kp-bg-primary/30 text-[0.625rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
                  <th className="px-5 py-3">{t('columns.name')}</th>
                  <th className="px-5 py-3">{t('columns.slug')}</th>
                  <th className="px-5 py-3">{t('columns.website')}</th>
                  <th className="px-5 py-3">{t('columns.status')}</th>
                  <th className="px-5 py-3 text-right">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((agency) => {
                  const isCurrent = agency.id === tenantContext.agencyId;
                  return (
                    <tr
                      key={agency.id}
                      className="border-b border-kp-border/60 transition-colors last:border-b-0 hover:bg-kp-bg-hover/40"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-kp-text-primary">{agency.name}</span>
                          {isCurrent && (
                            <span className="rounded-full border border-kp-accent/20 bg-kp-accent/10 px-2 py-0.5 text-[0.5625rem] font-bold text-kp-accent">
                              {t('current')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-kp-text-tertiary">{agency.slug}</td>
                      <td className="px-5 py-3.5 text-kp-text-secondary">
                        {agency.website || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={agency.isActive ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => switchTenant(agency.id, null, null)}
                              className="rounded-kp-md border border-kp-border px-2.5 py-1.5 text-[0.625rem] font-bold text-kp-text-secondary transition-colors hover:border-kp-accent hover:text-kp-accent"
                            >
                              {t('actions.switch')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(agency)}
                            title={t('actions.edit')}
                            className="rounded-kp-md p-2 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-accent"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            // Deleting the firm you are currently inside would
                            // strip your own tenant context mid-session.
                            disabled={isCurrent}
                            onClick={() => setToDelete(agency)}
                            title={isCurrent ? t('actions.deleteCurrentBlocked') : t('actions.delete')}
                            className="rounded-kp-md p-2 text-kp-text-tertiary transition-colors hover:bg-kp-danger/10 hover:text-kp-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-kp-text-tertiary"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-scale-in">
            <div className="flex items-center justify-between border-b border-kp-border bg-kp-bg-primary/30 px-6 py-4">
              <h3 className="flex items-center gap-2.5 text-base font-bold text-kp-text-primary">
                <span className="flex h-7 w-7 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                  <BuildingOffice2Icon className="h-4 w-4" />
                </span>
                {editing ? t('modal.editTitle') : t('modal.createTitle')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary transition-colors hover:text-kp-text-primary"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 p-6 text-xs">
                {formError && (
                  <div className="flex gap-2 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 p-3 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                    {t('modal.nameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('modal.namePlaceholder')}
                    className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3.5 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                    {t('modal.websiteLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://ornek.com"
                    className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3.5 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-hidden"
                  />
                </div>

                {editing && (
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-3.5 w-3.5 accent-kp-accent"
                    />
                    <span className="text-xs font-semibold text-kp-text-secondary">
                      {t('modal.activeLabel')}
                    </span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-kp-border bg-kp-bg-primary/50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover disabled:opacity-50"
                >
                  {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {t('modal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-scale-in">
            <div className="px-6 py-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-kp-text-primary">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" />
                {t('deleteModal.title')}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-kp-text-secondary">
                {t.rich('deleteModal.body', {
                  name: toDelete.name,
                  strong: (chunks) => (
                    <span className="font-bold text-kp-text-primary">{chunks}</span>
                  ),
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-kp-border bg-kp-bg-primary/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
              >
                {t('deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-danger px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                {t('deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
