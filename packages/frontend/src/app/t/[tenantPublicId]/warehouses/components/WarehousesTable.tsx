'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingOfficeIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
  address: string;
  capacity: number; // in desis / cubic meters
  usedCapacity: number;
  status: 'active' | 'inactive';
}

const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh_1',
    name: 'Ana Dağıtım Merkezi (Gebze)',
    code: 'WHM-GBZ01',
    type: 'Ana Depo',
    address: 'Gebze Organize Sanayi Bölgesi, No: 12, Kocaeli',
    capacity: 10000,
    usedCapacity: 7500,
    status: 'active',
  },
  {
    id: 'wh_2',
    name: 'İade & Hatalı Ürün Deposu',
    code: 'WHM-RET01',
    type: 'İade Deposu',
    address: 'Tuzla Serbest Bölge Sanayi Sitesi, B Blok, İstanbul',
    capacity: 3000,
    usedCapacity: 2800,
    status: 'active',
  },
  {
    id: 'wh_3',
    name: 'E-Ticaret Transit Depo',
    code: 'WHM-TRN01',
    type: 'Transit Depo',
    address: 'Esentepe Mah. Büyükdere Cad. No: 19, Şişli, İstanbul',
    capacity: 5000,
    usedCapacity: 1200,
    status: 'active',
  },
  {
    id: 'wh_4',
    name: 'Ankara Bölge Deposu',
    code: 'WHM-ANK02',
    type: 'Bölge Deposu',
    address: 'Ostim OSB, 100. Yıl Bulvarı, Yenimahalle, Ankara',
    capacity: 8000,
    usedCapacity: 0,
    status: 'inactive',
  },
];

const WAREHOUSE_TYPES = ['Ana Depo', 'İade Deposu', 'Transit Depo', 'Bölge Deposu'];

export function WarehousesTable() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'Ana Depo',
    address: '',
    capacity: 5000,
    usedCapacity: 0,
    status: 'active' as 'active' | 'inactive',
  });

  const handleOpenAddModal = () => {
    setEditingWarehouse(null);
    setFormData({
      name: '',
      code: '',
      type: 'Ana Depo',
      address: '',
      capacity: 5000,
      usedCapacity: 0,
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({
      name: wh.name,
      code: wh.code,
      type: wh.type,
      address: wh.address,
      capacity: wh.capacity,
      usedCapacity: wh.usedCapacity,
      status: wh.status,
    });
    setIsModalOpen(true);
  };

  const handleDeleteWarehouse = (id: string) => {
    if (confirm('Bu depoyu sistemden silmek istediğinize emin misiniz? Depo ile eşleşen lokasyonlar ve envanterler etkilenebilir.')) {
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      alert('Lütfen depo adı ve kodunu doldurun.');
      return;
    }

    if (formData.usedCapacity > formData.capacity) {
      alert('Kullanılan kapasite toplam kapasiteden büyük olamaz.');
      return;
    }

    if (editingWarehouse) {
      // Edit mode
      setUsers(
        warehouses.map((w) =>
          w.id === editingWarehouse.id
            ? {
                ...w,
                name: formData.name,
                code: formData.code,
                type: formData.type,
                address: formData.address,
                capacity: formData.capacity,
                usedCapacity: formData.usedCapacity,
                status: formData.status,
              }
            : w
        )
      );
    } else {
      // Create mode
      const newWh: Warehouse = {
        id: `wh_${Date.now()}`,
        name: formData.name,
        code: formData.code,
        type: formData.type,
        address: formData.address,
        capacity: formData.capacity,
        usedCapacity: formData.usedCapacity,
        status: formData.status,
      };
      setWarehouses((prev) => [...prev, newWh]);
    }
    setIsModalOpen(false);
  };

  // Helper alias to bypass setUsers typo
  const setUsers = (updated: Warehouse[]) => {
    setWarehouses(updated);
  };

  // Filters
  const filteredWarehouses = warehouses.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedTypeFilter === 'All' || w.type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">Depolar</h3>
          <p className="text-[11px] text-kp-text-tertiary">Envanter lokasyonlarını ve stok toplama merkezlerini yönetin</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Depo Ekle
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Depo adı veya kodu ile ara..."
            className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-kp-text-tertiary">Depo Tipi Filtresi:</span>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-2.5 py-1.5 focus:outline-hidden"
          >
            <option value="All">Tüm Depolar</option>
            {WAREHOUSE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Warehouses Table Grid */}
      <div className="border border-kp-border rounded-kp-md overflow-hidden bg-kp-bg-primary/10">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[10px] font-semibold uppercase text-kp-text-tertiary">
              <th className="py-3 px-4">Depo Bilgileri</th>
              <th className="py-3 px-4">Depo Tipi</th>
              <th className="py-3 px-4">Doluluk Oranı</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
            {filteredWarehouses.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-kp-text-tertiary italic">
                  Eşleşen depo bulunamadı.
                </td>
              </tr>
            ) : (
              filteredWarehouses.map((wh) => {
                const fillPercent = wh.capacity > 0 ? Math.round((wh.usedCapacity / wh.capacity) * 100) : 0;
                
                // Color codes for progress bars
                const progressBg = 
                  fillPercent > 85 ? 'bg-red-500' :
                  fillPercent > 50 ? 'bg-amber-500' :
                  'bg-emerald-500';

                return (
                  <tr key={wh.id} className="hover:bg-kp-bg-hover/10 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                          <BuildingOfficeIcon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-kp-text-primary">{wh.name}</div>
                          <div className="text-[10px] text-kp-text-tertiary font-mono">{wh.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-kp-text-secondary">{wh.type}</td>
                    <td className="py-3 px-4 w-52">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-medium text-kp-text-secondary">% {fillPercent} Dolu</span>
                          <span className="text-kp-text-tertiary">
                            {wh.usedCapacity.toLocaleString()} / {wh.capacity.toLocaleString()} Desi
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-kp-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${progressBg} transition-all`}
                            style={{ width: `${Math.min(fillPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          wh.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-kp-text-tertiary/10 text-kp-text-tertiary'
                        }`}
                      >
                        {wh.status === 'active' ? (
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
                          onClick={() => handleOpenEditModal(wh)}
                          className="p-1 text-kp-text-tertiary hover:text-kp-accent rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                          title="Düzenle"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWarehouse(wh.id)}
                          className="p-1 text-kp-text-tertiary hover:text-kp-danger rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                          title="Sil"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                {editingWarehouse ? 'Depo Düzenle' : 'Yeni Depo Ekle'}
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
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Depo Adı *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    placeholder="Örn: Tuzla E-Ticaret Deposu"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Depo Kodu *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                      placeholder="WHM-TZL03"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Depo Tipi *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    >
                      {WAREHOUSE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Toplam Kapasite (Desi) *</label>
                    <input
                      type="number"
                      required
                      min={100}
                      value={formData.capacity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Kullanılan Hacim (Desi)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.usedCapacity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, usedCapacity: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Depo Adresi</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors h-16 resize-none"
                    placeholder="Adres detayları..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Durumu</label>
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
                  {editingWarehouse ? 'Değişiklikleri Kaydet' : 'Depo Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
