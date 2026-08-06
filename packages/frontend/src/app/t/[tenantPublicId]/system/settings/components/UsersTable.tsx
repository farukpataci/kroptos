'use client';

import { useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon,
  BuildingStorefrontIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api';

interface AvailableStore {
  id: string;
  name: string;
  publicId: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: string;
  allowedStoreIds?: string[];
  allowedStores?: AvailableStore[];
}

const ROLES = ['super_admin', 'admin', 'manager', 'user', 'viewer'];

export function UsersTable() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [availableStores, setAvailableStores] = useState<AvailableStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'admin',
    status: 'active' as 'active' | 'inactive',
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<any>('/api/system/users');
      if (data?.users) {
        setUsers(data.users);
      }
      if (data?.availableStores) {
        setAvailableStores(data.availableStores);
      }
    } catch (err: any) {
      toast.error('Kullanıcı listesi yüklenemedi: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'admin',
      status: 'active',
    });
    setSelectedStoreIds(availableStores.map((s) => s.id));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    // Default to currently allowed store IDs or all if empty
    setSelectedStoreIds(user.allowedStoreIds || []);
    setIsModalOpen(true);
  };

  const handleToggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) {
      toast.warning('Yeni kullanıcı daveti için lütfen davet bağlantısını kullanın.');
      setIsModalOpen(false);
      return;
    }

    try {
      await apiFetch(`/api/system/users/${editingUser.id}/stores`, {
        method: 'PATCH',
        body: JSON.stringify({ storeIds: selectedStoreIds }),
      });
      toast.success(`${editingUser.name} için marka erişim yetkileri başarıyla güncellendi.`);
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error('Marka erişim yetkileri kaydedilemedi: ' + (err?.message || 'Hata oluştu'));
    }
  };

  // Filters
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRoleFilter === 'All' || u.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Header and Add Button */}
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">Kullanıcı Yönetimi</h3>
          <p className="text-[0.6875rem] text-kp-text-tertiary">Sistemdeki aktif kullanıcıları, rollerini ve marka erişim yetkilerini yönetin</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İsim veya e-posta ile ara..."
            className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
        </div>
      </div>

      {/* Users table grid */}
      <div className="card overflow-hidden">
        <table className="kp-table w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4">Kullanıcı</th>
              <th className="py-3 px-4">Rol</th>
              <th className="py-3 px-4">Erişebildiği Markalar</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-kp-text-tertiary">
                  Kullanıcılar yükleniyor...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-kp-text-tertiary">
                  Arama kriterlerine uygun kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kp-accent/10 text-kp-accent font-bold text-xs">
                        {getUserInitials(user.name)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-kp-text-primary">{user.name}</div>
                        <div className="text-[0.6875rem] text-kp-text-tertiary">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 rounded-kp-sm bg-kp-bg-primary px-2 py-0.5 text-[0.6875rem] font-medium text-kp-text-secondary border border-kp-border">
                      <ShieldCheckIcon className="h-3 w-3 text-kp-accent" />
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {!user.allowedStores || user.allowedStores.length === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-kp-sm bg-blue-500/10 px-2 py-0.5 text-[0.625rem] font-semibold text-blue-500 border border-blue-500/20">
                        <BuildingStorefrontIcon className="h-3 w-3" /> Tüm Markalar (Kısıtlamasız)
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.allowedStores.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 rounded-kp-sm bg-kp-accent/10 px-2 py-0.5 text-[0.625rem] font-semibold text-kp-accent border border-kp-accent/20"
                          >
                            <BuildingStorefrontIcon className="h-3 w-3" />
                            {s.name} ({s.publicId})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[0.6875rem] font-medium ${
                        user.status === 'active' ? 'text-kp-success' : 'text-kp-text-tertiary'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <>
                          <CheckCircleIcon className="h-3.5 w-3.5" /> Aktif
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-3.5 w-3.5" /> Pasif
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEditModal(user)}
                      className="p-1 text-kp-text-tertiary hover:text-kp-accent transition-colors"
                      title="Marka Erişim Yetkilerini Düzenle"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Permissions Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                  Marka Erişim Yetkileri Düzenle
                </h3>
                <p className="text-[0.6875rem] text-kp-text-tertiary">{editingUser.name} ({editingUser.email})</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="p-3.5 rounded-kp-md bg-kp-bg-primary/80 border border-kp-border text-xs text-kp-text-secondary">
                  <p className="font-semibold text-kp-text-primary mb-1">Marka Görünürlük Ayarları</p>
                  <p className="text-[0.6875rem] text-kp-text-tertiary">
                    Bu kullanıcının sistemde görebileceği ve işlem yapabileceği markaları işaretleyin.
                    Hiçbir marka seçilmezse kullanıcı tüm markalara erişebilir.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">
                    Erişilebilir Markalar ({availableStores.length})
                  </label>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {availableStores.map((store) => {
                      const isChecked = selectedStoreIds.includes(store.id);
                      return (
                        <label
                          key={store.id}
                          onClick={() => handleToggleStore(store.id)}
                          className={`flex items-center justify-between p-3 rounded-kp-md border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-kp-accent/10 border-kp-accent/40 text-kp-text-primary'
                              : 'bg-kp-bg-primary border-kp-border text-kp-text-secondary hover:border-kp-border-hover'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                            />
                            <div>
                              <div className="text-xs font-bold text-kp-text-primary">{store.name}</div>
                              <div className="text-[0.625rem] text-kp-text-tertiary font-mono">ID: {store.publicId}</div>
                            </div>
                          </div>

                          <span
                            className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-kp-sm ${
                              isChecked ? 'bg-kp-accent text-white' : 'bg-kp-bg-tertiary text-kp-text-tertiary'
                            }`}
                          >
                            {isChecked ? 'Erişim Var' : 'Erişim Yok'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold transition-colors"
                >
                  Marka Yetkilerini Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
