'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

const INITIAL_USERS: User[] = [
  {
    id: 'usr_1',
    name: 'Faruk Patacı',
    email: 'faruk@alqora.app',
    role: 'Administrator',
    status: 'active',
    createdAt: '12.04.2026',
  },
  {
    id: 'usr_2',
    name: 'Ahmet Yılmaz',
    email: 'ahmet.y@alqora.app',
    role: 'Depo Sorumlusu',
    status: 'active',
    createdAt: '15.05.2026',
  },
  {
    id: 'usr_3',
    name: 'Zeynep Kaya',
    email: 'zeynep.k@alqora.app',
    role: 'Muhasebe',
    status: 'active',
    createdAt: '01.06.2026',
  },
  {
    id: 'usr_4',
    name: 'Mehmet Demir',
    email: 'mehmet.d@alqora.app',
    role: 'Satış Temsilcisi',
    status: 'inactive',
    createdAt: '10.06.2026',
  },
];

const ROLES = ['Administrator', 'Depo Sorumlusu', 'Muhasebe', 'Satış Temsilcisi'];

export function UsersTable() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Administrator',
    status: 'active' as 'active' | 'inactive',
  });

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'Administrator',
      status: 'active',
    });
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
    setIsModalOpen(true);
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Bu kullanıcıyı sistemden silmek istediğinize emin misiniz?')) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.warning('Lütfen ad soyad ve e-posta alanlarını doldurun.');
      return;
    }

    if (editingUser) {
      // Edit mode
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: formData.name, email: formData.email, role: formData.role, status: formData.status }
            : u
        )
      );
    } else {
      // Create mode
      const newUser: User = {
        id: `usr_${Date.now()}`,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        createdAt: new Date().toLocaleDateString('tr-TR'),
      };
      setUsers((prev) => [...prev, newUser]);
    }
    setIsModalOpen(false);
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
          <p className="text-[11px] text-kp-text-tertiary">Sistemdeki aktif kullanıcıları ve rollerini yönetin</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
        >
          <UserPlusIcon className="h-4 w-4" />
          Kullanıcı Ekle
        </button>
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
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-kp-text-tertiary">Rol Filtresi:</span>
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-2.5 py-1.5 focus:outline-hidden"
          >
            <option value="All">Tüm Roller</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users table grid */}
      <div className="border border-kp-border rounded-kp-md overflow-hidden bg-kp-bg-primary/10">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[10px] font-semibold uppercase text-kp-text-tertiary">
              <th className="py-3 px-4">Kullanıcı</th>
              <th className="py-3 px-4">Rolü</th>
              <th className="py-3 px-4">Eklenme Tarihi</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-kp-text-tertiary italic">
                  Eşleşen kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-kp-bg-hover/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kp-accent/15 text-kp-accent font-semibold text-xs">
                        {getUserInitials(user.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-kp-text-primary">{user.name}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-kp-text-secondary">{user.role}</td>
                  <td className="py-3 px-4 text-kp-text-tertiary">{user.createdAt}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-kp-text-tertiary/10 text-kp-text-tertiary'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <>
                          <CheckCircleIcon className="h-3 w-3" />
                          Aktif
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-3 w-3" />
                          Pasif
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="p-1 text-kp-text-tertiary hover:text-kp-accent rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                        title="Düzenle"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1 text-kp-text-tertiary hover:text-kp-danger rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                        title="Sil"
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Davet Et'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Ad Soyad *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
                    placeholder="Örn: Faruk Patacı"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">E-Posta Adresi *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
                    placeholder="faruk@alqora.app"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Sistem Rolü *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Kullanıcı Durumu</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
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
                  {editingUser ? 'Kaydet' : 'Davet Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
