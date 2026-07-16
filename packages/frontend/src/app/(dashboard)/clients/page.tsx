'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Client {
  id: string;
  agencyId: string;
  name: string;
  legalName?: string;
  taxNumber?: string;
  taxOffice?: string;
  email: string;
  phone?: string;
  isActive: boolean;
  status: string;
}

export default function ClientsPage() {
  const { tenantContext } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    taxNumber: '',
    taxOffice: '',
    email: '',
    phone: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal States
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Client[]>('/clients');
      setClients(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clients');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantContext.agencyId) {
      fetchClients();
    } else {
      setIsLoading(false);
    }
  }, [tenantContext.agencyId]);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      legalName: '',
      taxNumber: '',
      taxOffice: '',
      email: '',
      phone: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      legalName: client.legalName || '',
      taxNumber: client.taxNumber || '',
      taxOffice: client.taxOffice || '',
      email: client.email || '',
      phone: client.phone || '',
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
      if (editingClient) {
        // Update client
        const updated = await apiFetch<Client>(`/clients/${editingClient.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
        setClients(clients.map(c => c.id === editingClient.id ? updated : c));
      } else {
        // Create client
        const payload = {
          ...formData,
          agencyId: tenantContext.agencyId,
        };
        const created = await apiFetch<Client>('/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setClients([created, ...clients]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/clients/${clientToDelete.id}`, {
        method: 'DELETE',
      });
      setClients(clients.filter(c => c.id !== clientToDelete.id));
      setClientToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete client');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!tenantContext.agencyId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <UserGroupIcon className="h-12 w-12 text-kp-text-tertiary animate-pulse" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Agency Context Required</h3>
        <p className="mt-1 max-w-xs text-xs text-kp-text-tertiary">
          Please select an active Agency context to view client listings.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading clients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Failed to load clients</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
        <button
          onClick={fetchClients}
          className="mt-4 flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-medium text-white hover:bg-kp-accent-hover transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <UserGroupIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-kp-text-primary">Clients</h1>
            <p className="text-[13px] text-kp-text-tertiary">Manage your client list and accounts context</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
        >
          <PlusIcon className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Legal Name</th>
                <th className="py-3 px-4">Tax Details</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-kp-text-tertiary">
                    No clients created yet under this agency. Click "Add Client" to get started.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-kp-text-primary">{client.name}</td>
                    <td className="py-3.5 px-4">{client.legalName || '-'}</td>
                    <td className="py-3.5 px-4">
                      {client.taxNumber ? `${client.taxNumber} (${client.taxOffice || ''})` : '-'}
                    </td>
                    <td className="py-3.5 px-4">{client.email}</td>
                    <td className="py-3.5 px-4">{client.phone || '-'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(client)}
                          className="p-1.5 rounded-kp-md text-kp-text-secondary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setClientToDelete(client)}
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
                {editingClient ? 'Edit Client Details' : 'Add New Client'}
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
                      Client / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Official Legal Name
                    </label>
                    <input
                      type="text"
                      value={formData.legalName}
                      onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                      placeholder="e.g. Acme International LLC"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Tax Number
                    </label>
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                      placeholder="10-digit number"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Tax Office
                    </label>
                    <input
                      type="text"
                      value={formData.taxOffice}
                      onChange={(e) => setFormData({ ...formData, taxOffice: e.target.value })}
                      placeholder="Tax office name"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="finance@acme.com"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +90 555 123 45 67"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                    />
                  </div>
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
                  {editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> Delete Client
              </h3>
              <button
                onClick={() => setClientToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-theme-sm text-kp-text-secondary">
                Are you sure you want to delete client <span className="font-semibold text-kp-text-primary">{clientToDelete.name}</span>? This action is soft-delete and will cascade to disable its stores and channels.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
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
