'use client';

import { useState } from 'react';
import {
  ShieldCheckIcon,
  PlusIcon,
  CheckIcon,
  TrashIcon,
  FolderIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface Permission {
  key: string;
  name: string;
  description: string;
}

interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: string[]; // List of permission keys granted to this role
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: 'Katalog & Ürünler',
    permissions: [
      { key: 'products.view', name: 'Ürünleri Görüntüle', description: 'Ürün listesini ve detaylarını görme yetkisi' },
      { key: 'products.create', name: 'Yeni Ürün Ekle', description: 'Kataloğa yeni ürün kartı tanımlama yetkisi' },
      { key: 'products.edit', name: 'Ürünleri Düzenle', description: 'Mevcut ürün bilgilerini ve pazaryeri eşleştirmelerini düzenleme yetkisi' },
      { key: 'products.delete', name: 'Ürünleri Sil', description: 'Katalogdan ürün kaydı silme yetkisi' },
    ],
  },
  {
    category: 'Envanter & Depolar',
    permissions: [
      { key: 'inventory.view', name: 'Stokları Görüntüle', description: 'Depo stok miktarlarını ve envanter listelerini görüntüleme yetkisi' },
      { key: 'inventory.adjust', name: 'Stok Düzeltme & Hareket', description: 'Manuel stok girişi, düzeltme ve depolar arası sevk yetkisi' },
      { key: 'warehouses.manage', name: 'Depoları Yönet', description: 'Depo bölgesi, raf ve lokasyon ayarlarını düzenleme yetkisi' },
    ],
  },
  {
    category: 'Sipariş Yönetimi',
    permissions: [
      { key: 'orders.view', name: 'Siparişleri Görüntüle', description: 'Pazaryerlerinden gelen tüm siparişleri görüntüleme yetkisi' },
      { key: 'orders.process', name: 'Sipariş Paketle & Fatura', description: 'Sipariş durumunu güncelleme, paketleme ve faturalandırma yetkisi' },
      { key: 'orders.cancel', name: 'Sipariş İptal / İade', description: 'Sipariş iptali veya iade süreçlerini yönetme yetkisi' },
    ],
  },
  {
    category: 'Entegrasyonlar',
    permissions: [
      { key: 'integrations.view', name: 'Bağlantıları Listele', description: 'Aktif Trendyol, ERP ve kargo entegrasyonlarını görüntüleme yetkisi' },
      { key: 'integrations.manage', name: 'Entegrasyon Düzenle', description: 'Entegrasyon bilgilerini güncelleme, yeni API anahtarı ekleme yetkisi' },
      { key: 'integrations.sync', name: 'Senkronizasyon Başlat', description: 'Manuel fiyat, stok ve sipariş eşitleme işlemlerini tetikleme yetkisi' },
    ],
  },
  {
    category: 'Sistem Ayarları',
    permissions: [
      { key: 'settings.view', name: 'Sistem Ayarlarını Gör', description: 'Mağaza bilgileri, şema ve genel parametre ayarlarını görüntüleme yetkisi' },
      { key: 'settings.edit', name: 'Sistem Ayarlarını Yönet', description: 'Genel mağaza parametrelerini değiştirme ve kullanıcı yönetimi yetkisi' },
      { key: 'logs.view', name: 'İşlem Loglarını İzle', description: 'Sistem güvenlik ve API haberleşme günlüklerini inceleme yetkisi' },
    ],
  },
];

const INITIAL_ROLES: Role[] = [
  {
    id: 'role_1',
    name: 'Administrator',
    description: 'Sistemdeki tüm alanlara erişim ve düzenleme yetkisine sahip tam yetkili yönetici rolü.',
    userCount: 1,
    permissions: [
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'inventory.view', 'inventory.adjust', 'warehouses.manage',
      'orders.view', 'orders.process', 'orders.cancel',
      'integrations.view', 'integrations.manage', 'integrations.sync',
      'settings.view', 'settings.edit', 'logs.view'
    ],
  },
  {
    id: 'role_2',
    name: 'Depo Sorumlusu',
    description: 'Stok hareketleri, envanter düzenlemeleri ve sipariş paketleme süreçlerini yöneten operasyonel rol.',
    userCount: 1,
    permissions: [
      'products.view',
      'inventory.view', 'inventory.adjust', 'warehouses.manage',
      'orders.view', 'orders.process'
    ],
  },
  {
    id: 'role_3',
    name: 'Muhasebe',
    description: 'Fatura, muhasebe entegrasyonları, sipariş raporları ve finansal alanları görüntüleyen rol.',
    userCount: 1,
    permissions: [
      'products.view',
      'inventory.view',
      'orders.view', 'orders.process',
      'settings.view'
    ],
  },
  {
    id: 'role_4',
    name: 'Satış Temsilcisi',
    description: 'Sadece ürün listeleme, stok izleme ve siparişlerin izlenmesini sağlayan kısıtlı rol.',
    userCount: 1,
    permissions: [
      'products.view',
      'inventory.view',
      'orders.view'
    ],
  },
];

export function RoleList() {
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState('role_1');
  
  // States for new custom role creation
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Save feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  const handleTogglePermission = (permissionKey: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoleId) return r;
        const exists = r.permissions.includes(permissionKey);
        const updatedPermissions = exists
          ? r.permissions.filter((k) => k !== permissionKey)
          : [...r.permissions, permissionKey];
        return { ...r, permissions: updatedPermissions };
      })
    );
  };

  const handleSavePermissions = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 800);
  };

  const handleAddRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;

    const newRole: Role = {
      id: `role_${Date.now()}`,
      name: newRoleName,
      description: newRoleDesc || `${newRoleName} için tanımlanmış sistem rolü.`,
      userCount: 0,
      permissions: ['products.view'], // Default view permission
    };

    setRoles((prev) => [...prev, newRole]);
    setSelectedRoleId(newRole.id);
    setNewRoleName('');
    setNewRoleDesc('');
    setIsAddingRole(false);
  };

  const handleDeleteRole = (roleId: string, roleName: string) => {
    if (roleId === 'role_1') {
      alert('Yönetici (Administrator) rolü korumalıdır ve silinemez.');
      return;
    }
    if (confirm(`"${roleName}" rolünü silmek istediğinize emin misiniz? Bu role sahip kullanıcılar yetkisiz kalacaktır.`)) {
      const remaining = roles.filter((r) => r.id !== roleId);
      setRoles(remaining);
      setSelectedRoleId(remaining[0].id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">Roller & Yetkiler</h3>
          <p className="text-[11px] text-kp-text-tertiary">Kullanıcı yetki seviyelerini ve yetki matrisini yönetin</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Roles List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="border border-kp-border rounded-kp-md p-4 bg-kp-bg-primary/5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-kp-text-secondary uppercase tracking-wider">Sistem Rolleri</span>
              
              {!isAddingRole && (
                <button
                  onClick={() => setIsAddingRole(true)}
                  className="text-[10px] font-semibold text-kp-accent hover:text-kp-accent-hover flex items-center gap-0.5"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Yeni Rol
                </button>
              )}
            </div>

            {/* Create custom role form */}
            {isAddingRole && (
              <form onSubmit={handleAddRoleSubmit} className="space-y-3 border border-kp-border/40 p-3 rounded-kp-md bg-kp-bg-secondary">
                <input
                  type="text"
                  required
                  placeholder="Rol İsmi (örn: Satınalma)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-kp-bg-primary border border-kp-border rounded px-2.5 py-1 text-xs text-kp-text-primary focus:outline-hidden"
                />
                <textarea
                  placeholder="Kısa Rol Açıklaması..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full bg-kp-bg-primary border border-kp-border rounded px-2.5 py-1 text-xs text-kp-text-primary focus:outline-hidden h-14 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingRole(false)}
                    className="text-[10px] font-semibold text-kp-text-tertiary hover:underline"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="bg-kp-accent text-white px-2 py-0.5 rounded text-[10px] font-semibold hover:bg-kp-accent-hover transition-colors"
                  >
                    Rol Ekle
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {roles.map((role) => {
                const isSelected = role.id === selectedRoleId;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`group relative w-full text-left p-3 rounded-kp-md border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-kp-accent/5 border-kp-accent/30 shadow-xs'
                        : 'bg-kp-bg-secondary border-kp-border hover:bg-kp-bg-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-kp-text-primary">{role.name}</div>
                      
                      {role.id !== 'role_1' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(role.id, role.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-kp-text-tertiary hover:text-kp-danger rounded hover:bg-kp-bg-hover transition-all"
                          title="Rolü Sil"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-kp-text-tertiary mt-1 line-clamp-2 leading-relaxed">
                      {role.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[9px] text-kp-text-tertiary">
                      <FolderIcon className="h-3 w-3" />
                      <span>{role.permissions.length} Yetki Tanımlı</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Permissions Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-kp-border rounded-kp-md p-5 bg-kp-bg-secondary space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-kp-border pb-3">
              <div>
                <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">
                  "{activeRole.name}" Rol Yetkileri
                </h4>
                <p className="text-[10px] text-kp-text-tertiary mt-0.5">
                  Bu role sahip kullanıcıların sistemde erişebileceği modülleri seçin.
                </p>
              </div>

              <button
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                )}
                {saveSuccess ? 'Kaydedildi' : 'Yetkileri Kaydet'}
              </button>
            </div>

            {/* Permission checklist organized by groups */}
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 divide-y divide-kp-border/30">
              {PERMISSION_GROUPS.map((group, groupIdx) => (
                <div key={group.category} className={`${groupIdx > 0 ? 'pt-5' : ''} space-y-3`}>
                  <h5 className="text-[10px] font-bold text-kp-accent uppercase tracking-wider">
                    {group.category}
                  </h5>

                  <div className="space-y-2">
                    {group.permissions.map((perm) => {
                      const isGranted = activeRole.permissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-3 p-3 rounded-kp-md border transition-all cursor-pointer ${
                            isGranted
                              ? 'bg-kp-bg-primary/20 border-kp-border/60'
                              : 'bg-kp-bg-secondary/40 border-kp-border/20 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isGranted}
                            onChange={() => handleTogglePermission(perm.key)}
                            className="mt-0.5 rounded border-kp-border text-kp-accent focus:ring-kp-accent/30 h-3.5 w-3.5 cursor-pointer"
                          />
                          <div className="flex-1 select-none">
                            <div className="font-semibold text-xs text-kp-text-primary">
                              {perm.name}
                            </div>
                            <div className="text-[10px] text-kp-text-tertiary mt-0.5 leading-relaxed">
                              {perm.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
