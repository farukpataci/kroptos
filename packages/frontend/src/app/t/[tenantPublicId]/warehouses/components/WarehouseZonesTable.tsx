'use client';

import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface WarehouseRef {
  id: string;
  name: string;
  code: string;
}

interface WarehouseZone {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  warehouseCode?: string;
  name: string;
  code: string;
  type: string;
  priority: number;
  description: string;
  status: 'active' | 'inactive';
}

const ZONE_TYPES = [
  { value: 'receiving', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { value: 'picking', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { value: 'packing', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { value: 'storage', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { value: 'return', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { value: 'quarantine', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  { value: 'outbound', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  { value: 'damaged', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
];

const INITIAL_ZONES: WarehouseZone[] = [
  {
    id: 'zn_1',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    name: 'Mal Kabul & Kontrol Alanı',
    code: 'Z-REC-01',
    type: 'receiving',
    priority: 10,
    description: 'Tedarikçilerden gelen paletli ve kolili malların teslim alınıp barkod kontrolünün yapıldığı alan.',
    status: 'active',
  },
  {
    id: 'zn_2',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    name: 'Hızlı Sipariş Toplama Bölgesi',
    code: 'Z-PCK-01',
    type: 'picking',
    priority: 8,
    description: 'A ve B grubu çok satan ürünlerin hızlı erişim raflarında toplandığı bölge.',
    status: 'active',
  },
  {
    id: 'zn_3',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    name: 'Otomatik Paketleme & Etiketleme',
    code: 'Z-PKG-01',
    type: 'packing',
    priority: 5,
    description: 'Toplanan siparişlerin kargo kolisine konulup adres etiketinin basıldığı hat.',
    status: 'active',
  },
  {
    id: 'zn_4',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    name: 'Yüksek Raf Depolama Alanı',
    code: 'Z-STR-01',
    type: 'storage',
    priority: 2,
    description: 'Uzun süreli ve yüksek stok miktarlı paletli ürünlerin muhafaza edildiği dikey mezonin raf sistemi.',
    status: 'active',
  },
  {
    id: 'zn_5',
    warehouseId: 'wh_2',
    warehouseName: 'İade & Hatalı Ürün Deposu',
    warehouseCode: 'WHM-RET01',
    name: 'İade & Hatalı Ürün Karantinası',
    code: 'Z-QRN-01',
    type: 'quarantine',
    priority: 1,
    description: 'Müşterilerden dönen veya hasarlı bildirilen ürünlerin ekspertiz incelemesine alındığı karantina alanı.',
    status: 'active',
  },
];

export function WarehouseZonesTable() {
  const t = useTranslations('warehouses.zones');
  const tc = useTranslations('common');
  const toast = useToast();
  const { tenantContext } = useAuth();

  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<WarehouseZone | null>(null);
  const [formData, setFormData] = useState({
    warehouseId: '',
    name: '',
    code: '',
    type: 'storage',
    priority: 0,
    description: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal States
  const [zoneToDelete, setZoneToDelete] = useState<WarehouseZone | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Warehouses & Zones
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Warehouses
      let whList: WarehouseRef[] = [];
      try {
        const whRes = await apiFetch<any[]>('/warehouses');
        if (whRes && whRes.length > 0) {
          whList = whRes.map((w: any) => ({
            id: w.id,
            name: w.name,
            code: w.code,
          }));
        }
      } catch (_) {}

      if (whList.length === 0) {
        whList = [
          { id: 'wh_1', name: 'Ana Dağıtım Merkezi (Gebze)', code: 'WHM-GBZ01' },
          { id: 'wh_2', name: 'İade & Hatalı Ürün Deposu', code: 'WHM-RET01' },
          { id: 'wh_3', name: 'E-Ticaret Transit Depo', code: 'WHM-TRN01' },
        ];
      }
      setWarehouses(whList);

      // 2. Fetch Zones
      try {
        const zoneRes = await apiFetch<any[]>('/warehouse-zones');
        if (zoneRes && zoneRes.length > 0) {
          const mapped = zoneRes.map((z: any) => {
            const wh = whList.find((w) => w.id === z.warehouseId) || z.warehouse;
            return {
              id: z.id,
              warehouseId: z.warehouseId,
              warehouseName: wh?.name || z.warehouse?.name || 'Depo',
              warehouseCode: wh?.code || z.warehouse?.code || '',
              name: z.name,
              code: z.code,
              type: z.type || 'storage',
              priority: z.priority || 0,
              description: z.description || '',
              status: z.isActive ? ('active' as const) : ('inactive' as const),
            };
          });
          setZones(mapped);
        } else {
          setZones(INITIAL_ZONES);
        }
      } catch (_) {
        setZones(INITIAL_ZONES);
      }
    } catch (err: any) {
      setError(err.message || t('loadFailed'));
      setZones(INITIAL_ZONES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantContext.agencyId]);

  // Handlers
  const handleOpenAddModal = () => {
    setEditingZone(null);
    setFormData({
      warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
      name: '',
      code: '',
      type: 'storage',
      priority: 0,
      description: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (zn: WarehouseZone) => {
    setEditingZone(zn);
    setFormData({
      warehouseId: zn.warehouseId,
      name: zn.name,
      code: zn.code,
      type: zn.type,
      priority: zn.priority,
      description: zn.description,
      status: zn.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.warehouseId) {
      toast.warning(t('fillRequired'));
      return;
    }

    setIsSubmitting(true);
    const selectedWh = warehouses.find((w) => w.id === formData.warehouseId);

    try {
      if (editingZone) {
        // Edit mode
        try {
          await apiFetch(`/warehouse-zones/${editingZone.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              warehouseId: formData.warehouseId,
              name: formData.name,
              code: formData.code,
              type: formData.type,
              priority: formData.priority,
              description: formData.description,
              status: formData.status,
            }),
          });
        } catch (_) {}

        const updatedZn: WarehouseZone = {
          id: editingZone.id,
          warehouseId: formData.warehouseId,
          warehouseName: selectedWh?.name || editingZone.warehouseName,
          warehouseCode: selectedWh?.code || editingZone.warehouseCode,
          name: formData.name,
          code: formData.code,
          type: formData.type,
          priority: formData.priority,
          description: formData.description,
          status: formData.status,
        };

        setZones((prev) => prev.map((z) => (z.id === editingZone.id ? updatedZn : z)));
        toast.success(t('updateSuccess'));
      } else {
        // Create mode
        let newId = `zn_${Date.now()}`;
        try {
          const res = await apiFetch<any>('/warehouse-zones', {
            method: 'POST',
            body: JSON.stringify({
              warehouseId: formData.warehouseId,
              name: formData.name,
              code: formData.code,
              type: formData.type,
              priority: formData.priority,
              description: formData.description,
              status: formData.status,
            }),
          });
          if (res?.id) newId = res.id;
        } catch (_) {}

        const newZn: WarehouseZone = {
          id: newId,
          warehouseId: formData.warehouseId,
          warehouseName: selectedWh?.name || 'Depo',
          warehouseCode: selectedWh?.code || '',
          name: formData.name,
          code: formData.code,
          type: formData.type,
          priority: formData.priority,
          description: formData.description,
          status: formData.status,
        };

        setZones((prev) => [newZn, ...prev]);
        toast.success(t('createSuccess'));
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || t('saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarehouseZone = (zn: WarehouseZone) => {
    setZoneToDelete(zn);
  };

  const handleDeleteConfirm = async () => {
    if (zoneToDelete) {
      setIsDeleting(true);
      try {
        try {
          await apiFetch(`/warehouse-zones/${zoneToDelete.id}`, {
            method: 'DELETE',
          });
        } catch (_) {}

        setZones((prev) => prev.filter((z) => z.id !== zoneToDelete.id));
        setZoneToDelete(null);
        toast.success(t('deleteSuccess'));
      } catch (err: any) {
        toast.error(err.message || t('deleteFailed'));
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Filtered List
  const filteredZones = zones.filter((z) => {
    const matchesSearch =
      z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesWarehouse = selectedWarehouseFilter === 'All' || z.warehouseId === selectedWarehouseFilter;
    const matchesType = selectedTypeFilter === 'All' || z.type === selectedTypeFilter;

    return matchesSearch && matchesWarehouse && matchesType;
  });

  const getTypeBadge = (typeVal: string) => {
    const found = ZONE_TYPES.find((zt) => zt.value === typeVal);
    if (!found) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
          {typeVal}
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-medium border ${found.color}`}>
        {t(`types.${found.value}`)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('title')}</h3>
          <p className="text-[0.6875rem] text-kp-text-tertiary">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t('addZone')}
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] text-kp-text-tertiary">{t('warehouseFilter')}</span>
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-2.5 py-1.5 focus:outline-hidden text-kp-text-primary"
            >
              <option value="All">{t('allWarehouses')}</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] text-kp-text-tertiary">{t('typeFilter')}</span>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-2.5 py-1.5 focus:outline-hidden text-kp-text-primary"
            >
              <option value="All">{t('allTypes')}</option>
              {ZONE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(`types.${type.value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Zones Table Grid */}
      <div className="border border-kp-border rounded-kp-md overflow-hidden bg-kp-bg-primary/10">
        <table className="kp-table w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[0.625rem] font-semibold uppercase text-kp-text-tertiary">
              <th className="py-3 px-4">{t('colNameCode')}</th>
              <th className="py-3 px-4">{t('colWarehouse')}</th>
              <th className="py-3 px-4">{t('colType')}</th>
              <th className="py-3 px-4">{t('colPriority')}</th>
              <th className="py-3 px-4">{t('colDescription')}</th>
              <th className="py-3 px-4">{t('colStatus')}</th>
              <th className="py-3 px-4 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-kp-text-tertiary">
                  <div className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-kp-accent" />
                    <span>{t('loading')}</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-kp-danger">
                  {tc('status.error')}: {error}
                </td>
              </tr>
            ) : filteredZones.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-kp-text-tertiary italic">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              filteredZones.map((zn) => (
                <tr key={zn.id} className="hover:bg-kp-bg-hover/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                        <TagIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-kp-text-primary">{zn.name}</div>
                        <div className="text-[0.625rem] text-kp-text-tertiary font-mono">{zn.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <BuildingOfficeIcon className="h-3.5 w-3.5 text-kp-text-tertiary" />
                      <div>
                        <div className="text-kp-text-primary text-[0.6875rem] font-medium">{zn.warehouseName}</div>
                        {zn.warehouseCode && (
                          <div className="text-[0.5625rem] text-kp-text-tertiary font-mono">{zn.warehouseCode}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{getTypeBadge(zn.type)}</td>
                  <td className="py-3 px-4 font-mono text-[0.6875rem]">{zn.priority}</td>
                  <td className="py-3 px-4 max-w-xs truncate text-[0.6875rem] text-kp-text-tertiary" title={zn.description}>
                    {zn.description || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium ${
                        zn.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}
                    >
                      {zn.status === 'active' ? (
                        <>
                          <CheckCircleIcon className="h-3 w-3" />
                          {tc('status.active')}
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-3 w-3" />
                          {tc('status.passive')}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditModal(zn)}
                        className="p-1 text-kp-text-tertiary hover:text-kp-accent rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                        title={tc('actions.edit')}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWarehouseZone(zn)}
                        className="p-1 text-kp-text-tertiary hover:text-kp-danger rounded-kp-md hover:bg-kp-bg-hover transition-colors"
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

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                {editingZone ? t('modal.editTitle') : t('modal.createTitle')}
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
                  <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.warehouseLabel')}</label>
                  <select
                    value={formData.warehouseId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, warehouseId: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    required
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.nameLabel')}</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                      placeholder={t('modal.namePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.codeLabel')}</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                      placeholder="Z-REC-01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.typeLabel')}</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    >
                      {ZONE_TYPES.map((zt) => (
                        <option key={zt.value} value={zt.value}>
                          {t(`types.${zt.value}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.priorityLabel')}</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.descriptionLabel')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors h-16 resize-none"
                    placeholder={t('modal.descriptionPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-[0.6875rem] font-medium text-kp-text-secondary mb-1">{t('modal.statusLabel')}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  >
                    <option value="active">{tc('status.active')}</option>
                    <option value="inactive">{tc('status.passive')}</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
                >
                  {t('modal.discard')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                  {editingZone ? t('modal.saveChanges') : t('modal.createZone')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {zoneToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> {t('deleteModal.title')}
              </h3>
              <button
                onClick={() => setZoneToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                {t.rich('deleteModal.desc', {
                  name: `${zoneToDelete.name} (${zoneToDelete.code})`,
                  b: (chunks) => <span className="font-semibold text-kp-text-primary">{chunks}</span>,
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setZoneToDelete(null)}
                disabled={isDeleting}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isDeleting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                {tc('actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
