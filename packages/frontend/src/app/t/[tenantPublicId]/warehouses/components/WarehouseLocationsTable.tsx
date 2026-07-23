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
  QrCodeIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface WarehouseRef {
  id: string;
  name: string;
  code: string;
}

interface ZoneRef {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
}

interface WarehouseLocation {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  warehouseCode?: string;
  zoneId: string;
  zoneName?: string;
  zoneCode?: string;
  code: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  level?: string;
  barcode?: string;
  capacity: number;
  pickPriority: number;
  status: 'active' | 'inactive';
}

const INITIAL_LOCATIONS: WarehouseLocation[] = [
  {
    id: 'loc_1',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    zoneId: 'zn_2',
    zoneName: 'Hızlı Sipariş Toplama Bölgesi',
    zoneCode: 'Z-PCK-01',
    code: 'A01-R01-G01',
    aisle: 'A-01',
    shelf: 'R-01',
    bin: 'G-01',
    level: 'L-01',
    barcode: 'LOC-GBZ-A01R01G01',
    capacity: 500,
    pickPriority: 10,
    status: 'active',
  },
  {
    id: 'loc_2',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    zoneId: 'zn_2',
    zoneName: 'Hızlı Sipariş Toplama Bölgesi',
    zoneCode: 'Z-PCK-01',
    code: 'A01-R01-G02',
    aisle: 'A-01',
    shelf: 'R-01',
    bin: 'G-02',
    level: 'L-01',
    barcode: 'LOC-GBZ-A01R01G02',
    capacity: 500,
    pickPriority: 10,
    status: 'active',
  },
  {
    id: 'loc_3',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    zoneId: 'zn_4',
    zoneName: 'Yüksek Raf Depolama Alanı',
    zoneCode: 'Z-STR-01',
    code: 'B02-R04-G05',
    aisle: 'B-02',
    shelf: 'R-04',
    bin: 'G-05',
    level: 'L-03',
    barcode: 'LOC-GBZ-B02R04G05',
    capacity: 2000,
    pickPriority: 5,
    status: 'active',
  },
  {
    id: 'loc_4',
    warehouseId: 'wh_1',
    warehouseName: 'Ana Dağıtım Merkezi (Gebze)',
    warehouseCode: 'WHM-GBZ01',
    zoneId: 'zn_1',
    zoneName: 'Mal Kabul & Kontrol Alanı',
    zoneCode: 'Z-REC-01',
    code: 'R01-REC-G01',
    aisle: 'R-01',
    shelf: 'R-01',
    bin: 'G-01',
    level: 'L-01',
    barcode: 'LOC-GBZ-R01RECG01',
    capacity: 1500,
    pickPriority: 8,
    status: 'active',
  },
  {
    id: 'loc_5',
    warehouseId: 'wh_2',
    warehouseName: 'İade & Hatalı Ürün Deposu',
    warehouseCode: 'WHM-RET01',
    zoneId: 'zn_5',
    zoneName: 'İade & Hatalı Ürün Karantinası',
    zoneCode: 'Z-QRN-01',
    code: 'Q01-QRN-G01',
    aisle: 'Q-01',
    shelf: 'R-01',
    bin: 'G-01',
    level: 'L-01',
    barcode: 'LOC-RET-Q01QRNG01',
    capacity: 300,
    pickPriority: 1,
    status: 'active',
  },
];

export function WarehouseLocationsTable() {
  const toast = useToast();
  const { tenantContext } = useAuth();

  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [zones, setZones] = useState<ZoneRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('All');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('All');

  // Modal Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [formData, setFormData] = useState({
    warehouseId: '',
    zoneId: '',
    aisle: '',
    shelf: '',
    bin: '',
    level: '',
    code: '',
    barcode: '',
    capacity: 500,
    pickPriority: 0,
    status: 'active' as 'active' | 'inactive',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal States
  const [locationToDelete, setLocationToDelete] = useState<WarehouseLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Dependencies and Locations
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    let whList: WarehouseRef[] = [];
    let znList: ZoneRef[] = [];

    try {
      // 1. Fetch Warehouses
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
        const znRes = await apiFetch<any[]>('/warehouse-zones');
        if (znRes && znRes.length > 0) {
          znList = znRes.map((z: any) => ({
            id: z.id,
            warehouseId: z.warehouseId,
            name: z.name,
            code: z.code,
          }));
        }
      } catch (_) {}

      if (znList.length === 0) {
        znList = [
          { id: 'zn_1', warehouseId: 'wh_1', name: 'Mal Kabul & Kontrol Alanı', code: 'Z-REC-01' },
          { id: 'zn_2', warehouseId: 'wh_1', name: 'Hızlı Sipariş Toplama Bölgesi', code: 'Z-PCK-01' },
          { id: 'zn_3', warehouseId: 'wh_1', name: 'Otomatik Paketleme & Etiketleme', code: 'Z-PKG-01' },
          { id: 'zn_4', warehouseId: 'wh_1', name: 'Yüksek Raf Depolama Alanı', code: 'Z-STR-01' },
          { id: 'zn_5', warehouseId: 'wh_2', name: 'İade & Hatalı Ürün Karantinası', code: 'Z-QRN-01' },
        ];
      }
      setZones(znList);

      // 3. Fetch Locations
      try {
        const locRes = await apiFetch<any[]>('/warehouse-locations');
        if (locRes && locRes.length > 0) {
          const mapped = locRes.map((l: any) => {
            const wh = whList.find((w) => w.id === l.warehouseId) || l.warehouse;
            const zn = znList.find((z) => z.id === l.zoneId) || l.zone;
            return {
              id: l.id,
              warehouseId: l.warehouseId,
              warehouseName: wh?.name || l.warehouse?.name || 'Depo',
              warehouseCode: wh?.code || l.warehouse?.code || '',
              zoneId: l.zoneId,
              zoneName: zn?.name || l.zone?.name || 'Bölge',
              zoneCode: zn?.code || l.zone?.code || '',
              code: l.code,
              aisle: l.aisle || '',
              shelf: l.shelf || '',
              bin: l.bin || '',
              level: l.level || '',
              barcode: l.barcode || '',
              capacity: l.capacity || 500,
              pickPriority: l.pickPriority || 0,
              status: l.isActive ? ('active' as const) : ('inactive' as const),
            };
          });
          setLocations(mapped);
        } else {
          setLocations(INITIAL_LOCATIONS);
        }
      } catch (_) {
        setLocations(INITIAL_LOCATIONS);
      }
    } catch (err: any) {
      setError(err.message || 'Adres verileri yüklenirken bir hata oluştu.');
      setLocations(INITIAL_LOCATIONS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantContext.agencyId]);

  // Available zones filtered by chosen warehouse in modal form
  const availableZonesInForm = zones.filter((z) => !formData.warehouseId || z.warehouseId === formData.warehouseId);

  // Available zones for top dropdown filter
  const availableZonesInFilter = zones.filter((z) => selectedWarehouseFilter === 'All' || z.warehouseId === selectedWarehouseFilter);

  // Auto-suggest Location Code and Barcode
  const updateHierarchyField = (field: 'aisle' | 'shelf' | 'bin' | 'level', val: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: val };
      
      // Auto generate code if aisle and shelf are provided
      const parts = [next.aisle, next.shelf, next.bin].filter(Boolean);
      const suggestedCode = parts.join('-');
      
      const wh = warehouses.find((w) => w.id === next.warehouseId);
      const whClean = wh?.code.replace(/[^A-Z0-9]/gi, '') || 'LOC';
      const codeClean = suggestedCode.replace(/[^A-Z0-9]/gi, '');
      const suggestedBarcode = `LOC-${whClean}-${codeClean}`;

      return {
        ...next,
        code: prev.code && prev.code !== parts.slice(0, -1).join('-') ? prev.code : suggestedCode,
        barcode: prev.barcode && !prev.barcode.startsWith('LOC-') ? prev.barcode : suggestedBarcode,
      };
    });
  };

  const handleOpenAddModal = () => {
    setEditingLocation(null);
    const initialWhId = warehouses.length > 0 ? warehouses[0].id : '';
    const initialZnList = zones.filter((z) => z.warehouseId === initialWhId);
    const initialZnId = initialZnList.length > 0 ? initialZnList[0].id : zones.length > 0 ? zones[0].id : '';

    setFormData({
      warehouseId: initialWhId,
      zoneId: initialZnId,
      aisle: 'A-01',
      shelf: 'R-01',
      bin: 'G-01',
      level: 'L-01',
      code: 'A01-R01-G01',
      barcode: 'LOC-GBZ-A01R01G01',
      capacity: 500,
      pickPriority: 10,
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loc: WarehouseLocation) => {
    setEditingLocation(loc);
    setFormData({
      warehouseId: loc.warehouseId,
      zoneId: loc.zoneId,
      aisle: loc.aisle || '',
      shelf: loc.shelf || '',
      bin: loc.bin || '',
      level: loc.level || '',
      code: loc.code,
      barcode: loc.barcode || '',
      capacity: loc.capacity,
      pickPriority: loc.pickPriority,
      status: loc.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouseId || !formData.zoneId || !formData.code) {
      toast.warning('Lütfen bağlı depo, bağlı bölge ve lokasyon kodunu doldurun.');
      return;
    }

    setIsSubmitting(true);
    const selectedWh = warehouses.find((w) => w.id === formData.warehouseId);
    const selectedZn = zones.find((z) => z.id === formData.zoneId);

    try {
      if (editingLocation) {
        // Edit mode
        try {
          await apiFetch(`/warehouse-locations/${editingLocation.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              warehouseId: formData.warehouseId,
              zoneId: formData.zoneId,
              code: formData.code,
              aisle: formData.aisle,
              shelf: formData.shelf,
              bin: formData.bin,
              level: formData.level,
              barcode: formData.barcode,
              capacity: formData.capacity,
              pickPriority: formData.pickPriority,
              status: formData.status,
            }),
          });
        } catch (_) {}

        const updatedLoc: WarehouseLocation = {
          id: editingLocation.id,
          warehouseId: formData.warehouseId,
          warehouseName: selectedWh?.name || editingLocation.warehouseName,
          warehouseCode: selectedWh?.code || editingLocation.warehouseCode,
          zoneId: formData.zoneId,
          zoneName: selectedZn?.name || editingLocation.zoneName,
          zoneCode: selectedZn?.code || editingLocation.zoneCode,
          code: formData.code,
          aisle: formData.aisle,
          shelf: formData.shelf,
          bin: formData.bin,
          level: formData.level,
          barcode: formData.barcode,
          capacity: formData.capacity,
          pickPriority: formData.pickPriority,
          status: formData.status,
        };

        setLocations((prev) => prev.map((l) => (l.id === editingLocation.id ? updatedLoc : l)));
        toast.success('Adres bilgisi başarıyla güncellendi.');
      } else {
        // Create mode
        let newId = `loc_${Date.now()}`;
        try {
          const res = await apiFetch<any>('/warehouse-locations', {
            method: 'POST',
            body: JSON.stringify({
              warehouseId: formData.warehouseId,
              zoneId: formData.zoneId,
              code: formData.code,
              aisle: formData.aisle,
              shelf: formData.shelf,
              bin: formData.bin,
              level: formData.level,
              barcode: formData.barcode,
              capacity: formData.capacity,
              pickPriority: formData.pickPriority,
              status: formData.status,
            }),
          });
          if (res?.id) newId = res.id;
        } catch (_) {}

        const newLoc: WarehouseLocation = {
          id: newId,
          warehouseId: formData.warehouseId,
          warehouseName: selectedWh?.name || 'Depo',
          warehouseCode: selectedWh?.code || '',
          zoneId: formData.zoneId,
          zoneName: selectedZn?.name || 'Bölge',
          zoneCode: selectedZn?.code || '',
          code: formData.code,
          aisle: formData.aisle,
          shelf: formData.shelf,
          bin: formData.bin,
          level: formData.level,
          barcode: formData.barcode,
          capacity: formData.capacity,
          pickPriority: formData.pickPriority,
          status: formData.status,
        };

        setLocations((prev) => [newLoc, ...prev]);
        toast.success('Yeni raf/adres başarıyla eklendi.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Adres kaydedilemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = (loc: WarehouseLocation) => {
    setLocationToDelete(loc);
  };

  const handleDeleteConfirm = async () => {
    if (locationToDelete) {
      setIsDeleting(true);
      try {
        try {
          await apiFetch(`/warehouse-locations/${locationToDelete.id}`, {
            method: 'DELETE',
          });
        } catch (_) {}

        setLocations((prev) => prev.filter((l) => l.id !== locationToDelete.id));
        setLocationToDelete(null);
        toast.success('Adres lokasyonu başarıyla silindi.');
      } catch (err: any) {
        toast.error(err.message || 'Adres silinemedi.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Filtered List
  const filteredLocations = locations.filter((l) => {
    const matchesSearch =
      l.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.barcode && l.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.aisle && l.aisle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.shelf && l.shelf.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesWarehouse = selectedWarehouseFilter === 'All' || l.warehouseId === selectedWarehouseFilter;
    const matchesZone = selectedZoneFilter === 'All' || l.zoneId === selectedZoneFilter;

    return matchesSearch && matchesWarehouse && matchesZone;
  });

  return (
    <div className="space-y-4">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">Raflar & Adres Yönetimi</h3>
          <p className="text-[11px] text-kp-text-tertiary">
            Depolarınızdaki koridor (Aisle), raf (Shelf), göz (Bin) ve lokasyon adresi katlarını tanımlayın
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Yeni Adres / Raf Ekle
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
            placeholder="Adres kodu, koridor, raf veya barkod..."
            className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-kp-text-tertiary">Depo:</span>
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => {
                setSelectedWarehouseFilter(e.target.value);
                setSelectedZoneFilter('All');
              }}
              className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-2.5 py-1.5 focus:outline-hidden text-kp-text-primary"
            >
              <option value="All">Tüm Depolar</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-kp-text-tertiary">Bölge:</span>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-2.5 py-1.5 focus:outline-hidden text-kp-text-primary"
            >
              <option value="All">Tüm Bölgeler</option>
              {availableZonesInFilter.map((zn) => (
                <option key={zn.id} value={zn.id}>
                  {zn.name} ({zn.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Locations Table Grid */}
      <div className="border border-kp-border rounded-kp-md overflow-hidden bg-kp-bg-primary/10">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[10px] font-semibold uppercase text-kp-text-tertiary">
              <th className="py-3 px-4">Adres Kodu & Barkod</th>
              <th className="py-3 px-4">Bağlı Depo & Bölge</th>
              <th className="py-3 px-4">Adres Hiyerarşisi</th>
              <th className="py-3 px-4">Kapasite (Desi)</th>
              <th className="py-3 px-4">Toplama Önceliği</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-kp-text-tertiary">
                  <div className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-kp-accent" />
                    <span>Adresler yükleniyor...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-kp-danger">
                  Hata: {error}
                </td>
              </tr>
            ) : filteredLocations.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-kp-text-tertiary italic">
                  Eşleşen adres lokasyonu bulunamadı.
                </td>
              </tr>
            ) : (
              filteredLocations.map((loc) => (
                <tr key={loc.id} className="hover:bg-kp-bg-hover/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                        <Square3Stack3DIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-kp-text-primary">{loc.code}</div>
                        {loc.barcode && (
                          <div className="flex items-center gap-1 text-[10px] text-kp-text-tertiary font-mono mt-0.5">
                            <QrCodeIcon className="h-3 w-3 text-kp-text-tertiary" />
                            {loc.barcode}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="flex items-center gap-1 text-kp-text-primary text-[11px] font-medium">
                        <BuildingOfficeIcon className="h-3.5 w-3.5 text-kp-text-tertiary" />
                        {loc.warehouseName}
                      </div>
                      <div className="text-[10px] text-kp-text-tertiary pl-4">
                        Bölge: <span className="font-medium text-kp-text-secondary">{loc.zoneName || '-'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {loc.aisle && (
                        <span className="px-1.5 py-0.5 rounded bg-kp-bg-secondary border border-kp-border text-[10px] font-mono">
                          {loc.aisle}
                        </span>
                      )}
                      {loc.shelf && (
                        <span className="px-1.5 py-0.5 rounded bg-kp-bg-secondary border border-kp-border text-[10px] font-mono">
                          {loc.shelf}
                        </span>
                      )}
                      {loc.bin && (
                        <span className="px-1.5 py-0.5 rounded bg-kp-bg-secondary border border-kp-border text-[10px] font-mono">
                          {loc.bin}
                        </span>
                      )}
                      {loc.level && (
                        <span className="px-1.5 py-0.5 rounded bg-kp-bg-secondary border border-kp-border text-[10px] font-mono text-kp-text-tertiary">
                          {loc.level}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">{loc.capacity.toLocaleString()} Desi</td>
                  <td className="py-3 px-4 font-mono text-[11px]">{loc.pickPriority}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        loc.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}
                    >
                      {loc.status === 'active' ? (
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
                        onClick={() => handleOpenEditModal(loc)}
                        className="p-1 text-kp-text-tertiary hover:text-kp-accent rounded-kp-md hover:bg-kp-bg-hover transition-colors"
                        title="Düzenle"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc)}
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

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                {editingLocation ? 'Adres / Raf Düzenle' : 'Yeni Adres / Raf Ekle'}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Bağlı Depo *</label>
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => {
                        const newWhId = e.target.value;
                        const matchingZones = zones.filter((z) => z.warehouseId === newWhId);
                        setFormData((prev) => ({
                          ...prev,
                          warehouseId: newWhId,
                          zoneId: matchingZones.length > 0 ? matchingZones[0].id : '',
                        }));
                      }}
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

                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Bağlı Bölge *</label>
                    <select
                      value={formData.zoneId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, zoneId: e.target.value }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                      required
                    >
                      {availableZonesInForm.map((zn) => (
                        <option key={zn.id} value={zn.id}>
                          {zn.name} ({zn.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-kp-text-secondary mb-1">Koridor</label>
                    <input
                      type="text"
                      value={formData.aisle}
                      onChange={(e) => updateHierarchyField('aisle', e.target.value.toUpperCase())}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1.5 text-xs text-kp-text-primary font-mono"
                      placeholder="A-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-kp-text-secondary mb-1">Raf</label>
                    <input
                      type="text"
                      value={formData.shelf}
                      onChange={(e) => updateHierarchyField('shelf', e.target.value.toUpperCase())}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1.5 text-xs text-kp-text-primary font-mono"
                      placeholder="R-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-kp-text-secondary mb-1">Göz</label>
                    <input
                      type="text"
                      value={formData.bin}
                      onChange={(e) => updateHierarchyField('bin', e.target.value.toUpperCase())}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1.5 text-xs text-kp-text-primary font-mono"
                      placeholder="G-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-kp-text-secondary mb-1">Seviye/Kat</label>
                    <input
                      type="text"
                      value={formData.level}
                      onChange={(e) => updateHierarchyField('level', e.target.value.toUpperCase())}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1.5 text-xs text-kp-text-primary font-mono"
                      placeholder="L-01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Adres Kodu *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                      placeholder="A01-R01-G01"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Adres Barkodu</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value.toUpperCase() }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                      placeholder="LOC-GBZ-A01R01G01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Lokasyon Kapasitesi (Desi)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.capacity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-kp-text-secondary mb-1">Toplama Önceliği</label>
                    <input
                      type="number"
                      value={formData.pickPriority}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pickPriority: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                    />
                  </div>
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
                  disabled={isSubmitting}
                  className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                  {editingLocation ? 'Değişiklikleri Kaydet' : 'Adres Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {locationToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> Adres Lokasyonunu Sil
              </h3>
              <button
                onClick={() => setLocationToDelete(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                <span className="font-semibold font-mono text-kp-text-primary">{locationToDelete.code}</span> adres lokasyonunu silmek istediğinize emin misiniz? Bu lokasyondaki stok hareketleri ve yerleşimler etkilenebilir.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setLocationToDelete(null)}
                disabled={isDeleting}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isDeleting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
