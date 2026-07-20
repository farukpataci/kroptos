'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  CubeIcon,
  ChartBarIcon,
  MapIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
  InboxArrowDownIcon,
  TagIcon,
  CpuChipIcon,
  BellIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// Helper function to extract and sanitize image URLs from potential JSON arrays and single slash issues
const getProductImage = (imageStr?: string | null): string => {
  if (!imageStr) return 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100&auto=format&fit=crop&q=60';
  let url = imageStr.trim();
  if (url.startsWith('[')) {
    try {
      const parsed = JSON.parse(url);
      if (Array.isArray(parsed) && parsed.length > 0) {
        url = parsed[0];
      }
    } catch (_) {
      try {
        const matches = url.match(/"([^"]+)"/);
        if (matches && matches[1]) {
          url = matches[1];
        }
      } catch (__) {}
    }
  }
  // Repair single slash in protocol
  if (url.startsWith('https:/') && !url.startsWith('https://')) {
    url = url.replace('https:/', 'https://');
  } else if (url.startsWith('http:/') && !url.startsWith('http://')) {
    url = url.replace('http:/', 'http://');
  }
  return url;
};

// Mock types matching the prompt requirements
interface WmsProduct {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  image: string;
  warehouse: string;
  location: string;
  available: number;
  reserved: number;
  incoming: number;
  outgoing: number;
  damaged: number;
  allocated: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  safetyStock: number;
  status: 'Healthy' | 'Low Stock' | 'Critical' | 'Out of Stock' | 'Overstock' | 'Damaged' | 'Blocked' | 'Discontinued';
  lastMovement: string;
  lastCount: string;
  supplier: string;
  category: string;
  brand: string;
  updatedAt: string;
  abcClass: 'A' | 'B' | 'C';
  batchNumber?: string;
  lotNumber?: string;
  serialNumber?: string;
  expirationDate?: string;
}

interface StockMovementLog {
  id: string;
  sku: string;
  name: string;
  type: 'Inbound' | 'Outbound' | 'Transfer' | 'Adjustment' | 'Reservation' | 'Damage' | 'Lost' | 'Cycle Count';
  warehouse: string;
  location: string;
  beforeQty: number;
  afterQty: number;
  difference: number;
  performedBy: string;
  notes: string;
  createdAt: string;
}

export default function InventoryPage() {
  const toast = useToast();
  const { tenantContext } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'map' | 'movements' | 'lowstock' | 'counting' | 'reservations' | 'integrations' | 'ai' | 'alerts'>('dashboard');
  
  // Real backend search compatibility
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  // States for stock ledger tab
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortField, setSortField] = useState<keyof WmsProduct>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    sku: true,
    warehouse: true,
    location: true,
    available: true,
    reserved: true,
    incoming: true,
    damaged: true,
    status: true,
    actions: true
  });

  // Drawer overlay state
  const [selectedProduct, setSelectedProduct] = useState<WmsProduct | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerSubTab, setDrawerSubTab] = useState<'details' | 'locations' | 'reservations' | 'movements' | 'ai'>('details');

  // Form modals state
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);

  // Initial Mock WMS products matching full schema details
  const [products, setProducts] = useState<WmsProduct[]>([
    {
      id: 'prod-1',
      sku: 'WMS-101-BLK',
      barcode: '8681234560012',
      name: 'Wireless Barcode Scanner Pro',
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&auto=format&fit=crop&q=60',
      warehouse: 'Istanbul Main',
      location: 'Aisle A - Rack 3 - Shelf B - Bin 12',
      available: 480,
      reserved: 35,
      incoming: 120,
      outgoing: 45,
      damaged: 2,
      allocated: 35,
      minStock: 100,
      maxStock: 1000,
      reorderPoint: 150,
      safetyStock: 50,
      status: 'Healthy',
      lastMovement: '2026-07-02 10:15',
      lastCount: '2026-06-25',
      supplier: 'LogiTech Supply Co.',
      category: 'Hardware',
      brand: 'KroptOS Tech',
      updatedAt: '2026-07-02 10:15',
      abcClass: 'A',
      batchNumber: 'BT-2026-05A',
      lotNumber: 'LT-9801',
      serialNumber: 'SN-901823091',
      expirationDate: '2029-12-31'
    },
    {
      id: 'prod-2',
      sku: 'WMS-402-BLU',
      barcode: '8681234560029',
      name: 'Thermal Shipping Label Printer',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&auto=format&fit=crop&q=60',
      warehouse: 'Istanbul Main',
      location: 'Aisle B - Rack 1 - Shelf A - Bin 04',
      available: 12,
      reserved: 8,
      incoming: 50,
      outgoing: 12,
      damaged: 1,
      allocated: 8,
      minStock: 20,
      maxStock: 200,
      reorderPoint: 30,
      safetyStock: 10,
      status: 'Low Stock',
      lastMovement: '2026-07-01 16:30',
      lastCount: '2026-06-28',
      supplier: 'Zebra Print Corp',
      category: 'Hardware',
      brand: 'PrintPro',
      updatedAt: '2026-07-01 16:30',
      abcClass: 'A',
      batchNumber: 'BT-2026-11B',
      lotNumber: 'LT-3301',
      serialNumber: 'SN-102930219',
      expirationDate: '2030-01-15'
    },
    {
      id: 'prod-3',
      sku: 'WMS-709-RED',
      barcode: '8681234560036',
      name: 'RFID Pallet Tracking Beacon',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=100&auto=format&fit=crop&q=60',
      warehouse: 'Munich Transit',
      location: 'Aisle C - Rack 5 - Shelf D - Bin 01',
      available: 0,
      reserved: 0,
      incoming: 1000,
      outgoing: 0,
      damaged: 0,
      allocated: 0,
      minStock: 200,
      maxStock: 5000,
      reorderPoint: 500,
      safetyStock: 100,
      status: 'Out of Stock',
      lastMovement: '2026-06-30 08:24',
      lastCount: '2026-06-20',
      supplier: 'Sensors AG',
      category: 'IoT Devices',
      brand: 'RF-Tag',
      updatedAt: '2026-06-30 08:24',
      abcClass: 'B',
      batchNumber: 'BT-RFID-99',
      lotNumber: 'LT-0182',
      serialNumber: 'SN-772819280',
      expirationDate: '2028-06-30'
    },
    {
      id: 'prod-4',
      sku: 'WMS-901-WHT',
      barcode: '8681234560043',
      name: 'Industrial Pallet Wrapper Roll (Film)',
      image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=100&auto=format&fit=crop&q=60',
      warehouse: 'Istanbul Main',
      location: 'Aisle D - Rack 12 - Shelf A - Bin 02',
      available: 850,
      reserved: 200,
      incoming: 0,
      outgoing: 120,
      damaged: 8,
      allocated: 200,
      minStock: 100,
      maxStock: 800,
      reorderPoint: 200,
      safetyStock: 50,
      status: 'Overstock',
      lastMovement: '2026-07-02 11:20',
      lastCount: '2026-06-30',
      supplier: 'PolyWrap Packaging',
      category: 'Consumables',
      brand: 'FlexiWrap',
      updatedAt: '2026-07-02 11:20',
      abcClass: 'C',
      batchNumber: 'BT-POLY-88',
      lotNumber: 'LT-1029',
      expirationDate: '2027-05-18'
    },
    {
      id: 'prod-5',
      sku: 'WMS-108-SLV',
      barcode: '8681234560050',
      name: 'Heavy-Duty Forklift Camera System',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=60',
      warehouse: 'Munich Transit',
      location: 'Aisle A - Rack 2 - Shelf C - Bin 08',
      available: 4,
      reserved: 1,
      incoming: 10,
      outgoing: 2,
      damaged: 1,
      allocated: 1,
      minStock: 5,
      maxStock: 30,
      reorderPoint: 8,
      safetyStock: 2,
      status: 'Critical',
      lastMovement: '2026-07-02 09:40',
      lastCount: '2026-06-22',
      supplier: 'VisionTech Logistics',
      category: 'Hardware',
      brand: 'CamEye',
      updatedAt: '2026-07-02 09:40',
      abcClass: 'B',
      batchNumber: 'BT-CAM-09',
      lotNumber: 'LT-4501',
      serialNumber: 'SN-CAM-108271',
      expirationDate: '2031-10-12'
    }
  ]);

  // Movements log list
  const [movements, setMovements] = useState<StockMovementLog[]>([
    {
      id: 'MOV-10029',
      sku: 'WMS-101-BLK',
      name: 'Wireless Barcode Scanner Pro',
      type: 'Inbound',
      warehouse: 'Istanbul Main',
      location: 'Aisle A - Rack 3 - Shelf B - Bin 12',
      beforeQty: 360,
      afterQty: 480,
      difference: 120,
      performedBy: 'Faruk Pataci',
      notes: 'Received batch from LogiTech PO #29810',
      createdAt: '2026-07-02 10:15'
    },
    {
      id: 'MOV-10028',
      sku: 'WMS-901-WHT',
      name: 'Industrial Pallet Wrapper Roll (Film)',
      type: 'Reservation',
      warehouse: 'Istanbul Main',
      location: 'Aisle D - Rack 12 - Shelf A - Bin 02',
      beforeQty: 1050,
      afterQty: 850,
      difference: -200,
      performedBy: 'System API (Shopify Sync)',
      notes: 'Auto-allocation for Order #SHPFY-87162',
      createdAt: '2026-07-02 11:20'
    },
    {
      id: 'MOV-10027',
      sku: 'WMS-108-SLV',
      name: 'Heavy-Duty Forklift Camera System',
      type: 'Adjustment',
      warehouse: 'Munich Transit',
      location: 'Aisle A - Rack 2 - Shelf C - Bin 08',
      beforeQty: 5,
      afterQty: 4,
      difference: -1,
      performedBy: 'Ahmet Karaca (Operator)',
      notes: 'Damaged during stock relocation in Aisle A',
      createdAt: '2026-07-02 09:40'
    }
  ]);

  // Inventory counting audits state
  const [auditCounts, setAuditCounts] = useState([
    { id: 'CNT-901', sku: 'WMS-101-BLK', name: 'Wireless Barcode Scanner Pro', systemQty: 480, countedQty: 480, diff: 0, status: 'Matched', date: '2026-07-02' },
    { id: 'CNT-902', sku: 'WMS-402-BLU', name: 'Thermal Shipping Label Printer', systemQty: 12, countedQty: 10, diff: -2, status: 'Pending Approval', date: '2026-07-02' },
    { id: 'CNT-903', sku: 'WMS-901-WHT', name: 'Industrial Pallet Wrapper Roll (Film)', systemQty: 850, countedQty: 855, diff: 5, status: 'Pending Approval', date: '2026-07-02' }
  ]);

  // Alert feed
  const [alerts, setAlerts] = useState([
    { id: 'ALT-01', severity: 'critical', message: 'Thermal Shipping Label Printer (WMS-402-BLU) stock is critical (12 available, minimum is 20).', date: '2026-07-02 11:15' },
    { id: 'ALT-02', severity: 'warning', message: 'Inventory mismatch of -2 units detected for SKU WMS-402-BLU during Spot Count.', date: '2026-07-02 10:45' },
    { id: 'ALT-03', severity: 'info', message: 'Successful stock sync with Logo ERP completed. 15 SKUs updated.', date: '2026-07-02 09:00' }
  ]);

  // Fetch real data on mount to complement mock data
  const fetchInventory = async () => {
    setLoadingDb(true);
    try {
      const data = await apiFetch<any[]>('/inventory');
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          sku: item.product.sku,
          barcode: item.product.barcode || 'N/A',
          name: item.product.name,
          image: item.product.image || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&auto=format&fit=crop&q=60',
          warehouse: 'Istanbul Main',
          location: item.product.location || 'Aisle A - Rack 3 - Shelf B - Bin 12',
          available: item.availableQty,
          reserved: item.reservedQty,
          incoming: 50,
          outgoing: 10,
          damaged: item.defectiveQty,
          allocated: item.reservedQty,
          minStock: item.reorderLevel,
          maxStock: 500,
          reorderPoint: item.reorderLevel * 1.5,
          safetyStock: item.reorderLevel / 2,
          status: (item.availableQty === 0 ? 'Out of Stock' :
                  item.availableQty < item.reorderLevel ? 'Low Stock' : 'Healthy') as any,
          lastMovement: new Date(item.updatedAt).toLocaleDateString(),
          lastCount: new Date(item.updatedAt).toLocaleDateString(),
          supplier: 'Default Supplier',
          category: item.product.category?.name || 'General',
          brand: 'KroptOS',
          updatedAt: new Date(item.updatedAt).toLocaleDateString(),
          abcClass: (item.availableQty > 100 ? 'A' : 'B') as any
        }));
        setProducts(mapped);
      }
    } catch (err) {
      console.error('API Fetch failed, using WMS demo fallback:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const logs = await apiFetch<any[]>('/inventory/movements');
      if (logs && logs.length > 0) {
        const mappedLogs = logs.map((log: any) => ({
          id: log.id,
          sku: log.inventory.product.sku,
          name: log.inventory.product.name,
          type: (log.type === 'inbound' ? 'Inbound' :
                log.type === 'outbound' ? 'Outbound' :
                log.type === 'damage' ? 'Damage' : 'Adjustment') as any,
          warehouse: 'Istanbul Main',
          location: 'Aisle A',
          beforeQty: log.inventory.availableQty - log.quantity,
          afterQty: log.inventory.availableQty,
          difference: log.quantity,
          performedBy: log.performedBy || 'System',
          notes: log.reason || 'WMS Transaction',
          createdAt: new Date(log.createdAt).toLocaleString()
        }));
        setMovements(mappedLogs);
      }
    } catch (err) {
      console.error('API Fetch movements failed:', err);
    }
  };

  useEffect(() => {
    if (tenantContext?.storeId) {
      fetchInventory();
      fetchMovements();
    }
  }, [tenantContext?.storeId]);

  // Filter & Sort Logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.barcode.includes(searchTerm) ||
                          (p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesWarehouse = selectedWarehouse === 'All' || p.warehouse === selectedWarehouse;
    const matchesStatus = selectedStatus === 'All' || p.status === selectedStatus;
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

    return matchesSearch && matchesWarehouse && matchesStatus && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];

    if (valA === undefined) return 1;
    if (valB === undefined) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return 0;
  });

  const handleSort = (field: keyof WmsProduct) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [col]: !prev[col]
    }));
  };

  // KPI Calculations
  const totalProducts = products.length + dbProducts.length;
  const availableQty = products.reduce((acc, curr) => acc + curr.available, 0);
  const reservedQtyVal = products.reduce((acc, curr) => acc + curr.reserved, 0);
  const incomingQty = products.reduce((acc, curr) => acc + curr.incoming, 0);
  const damagedQty = products.reduce((acc, curr) => acc + curr.damaged, 0);
  const lowStockCount = products.filter(p => p.status === 'Low Stock' || p.status === 'Critical').length;
  const outOfStockCount = products.filter(p => p.status === 'Out of Stock').length;
  const totalValuation = products.reduce((acc, curr) => acc + (curr.available * 125), 0); // Mock average unit value: $125

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Module Title / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-kp-border pb-4">
        <div>
          <h1 className="text-xl font-semibold text-kp-text-primary flex items-center gap-2.5">
            <CubeIcon className="h-6 w-6 text-kp-accent" />
            Stok & Envanter Kontrolü
          </h1>
          <p className="mt-1 text-[13px] text-kp-text-tertiary">
            Stok seviyelerini, depo envanterini, rezervasyonları, stok ikmallerini, stok hareketlerini ve uyarıları izleyin.
          </p>
        </div>
        
        {/* Action buttons matching the design system */}
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button
            onClick={() => setIsInboundModalOpen(true)}
            className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Hızlı Giriş (Mal Kabul)
          </button>
          <button
            onClick={() => {
              setProducts(prev => prev.map(p => p.sku === 'WMS-402-BLU' ? { ...p, available: 120, status: 'Healthy' } : p));
              setAlerts(prev => [
                { id: `ALT-${Date.now()}`, severity: 'info', message: 'Manual stock sync triggered. WMS-402-BLU replenished.', date: 'Just now' },
                ...prev
              ]);
            }}
            className="flex items-center gap-2 rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-secondary hover:bg-kp-bg-hover px-4 py-2.5 text-xs font-semibold shadow-sm transition-all"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Kanalları Eşitle
          </button>
        </div>
      </div>

      {/* WMS Module Sub-navigation Tabs */}
      <div className="flex border-b border-kp-border overflow-x-auto scrollbar-hide mb-4">
        {[
          { id: 'dashboard', label: 'Özet Panel', icon: ChartBarIcon },
          { id: 'ledger', label: 'Stok Listesi', icon: CubeIcon },
          { id: 'map', label: 'Depo Haritası', icon: MapIcon },
          { id: 'movements', label: 'Hareket Kayıtları', icon: ClockIcon },
          { id: 'lowstock', label: 'Stok İkmali', icon: ExclamationTriangleIcon },
          { id: 'counting', label: 'Sayım & Denetim', icon: AdjustmentsHorizontalIcon },
          { id: 'reservations', label: 'Rezervasyonlar', icon: TagIcon },
          { id: 'integrations', label: 'Entegrasyonlar', icon: InboxArrowDownIcon },
          { id: 'ai', label: 'Yapay Zeka Analizi', icon: CpuChipIcon },
          { id: 'alerts', label: 'Uyarı Merkezi', icon: BellIcon }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap transition-all ${
                isActive
                  ? 'border-kp-accent text-kp-accent'
                  : 'border-transparent text-kp-text-tertiary hover:text-kp-text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'lowstock' && lowStockCount > 0 && (
                <span className="ml-1 rounded-full bg-kp-warning-muted px-2 py-0.5 text-[9px] font-extrabold text-kp-warning">
                  {lowStockCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. DASHBOARD & ANALYTICS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 12 Enterprise KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Products', value: totalProducts, change: '+4 New', trend: 'up' },
              { label: 'Available Stock', value: availableQty.toLocaleString(), change: '91% of max', trend: 'up' },
              { label: 'Reserved Stock', value: reservedQtyVal, change: '15 Pending orders', trend: 'down' },
              { label: 'Incoming Stock', value: incomingQty, change: '3 Inbound POs', trend: 'up' },
              { label: 'Outgoing Today', value: '182 Units', change: '8 Shipments', trend: 'up' },
              { label: 'Low Stock Items', value: lowStockCount, change: 'Needs action', trend: 'down' },
              { label: 'Out of Stock', value: outOfStockCount, change: 'Restock scheduled', trend: 'down' },
              { label: 'Warehouse Cap.', value: '84.6%', change: 'Aisle B Congested', trend: 'up' },
              { label: 'Damaged Qty', value: damagedQty, change: 'Valued at $350', trend: 'down' },
              { label: 'Inventory Value', value: `$${totalValuation.toLocaleString()}`, change: '+2.8% vs last week', trend: 'up' },
              { label: 'Avg. Stock Age', value: '18 Days', change: 'A-Class fast rotation', trend: 'down' },
              { label: 'Count Accuracy', value: '99.88%', change: 'Target 99.9%', trend: 'up' }
            ].map((kpi, idx) => (
              <div key={idx} className="card flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary block mb-1">
                    {kpi.label}
                  </span>
                  <span className="text-lg font-extrabold text-kp-text-primary">
                    {kpi.value}
                  </span>
                </div>
                
                {/* Sparkline trend path */}
                <div className="my-2.5 h-6 w-full">
                  <svg className="h-full w-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                    <path
                      d={idx % 2 === 0 ? "M 0 25 Q 20 5, 40 20 T 80 10 T 100 5" : "M 0 5 Q 25 25, 50 15 T 75 25 T 100 20"}
                      fill="none"
                      stroke={kpi.trend === 'up' ? '#12B76A' : '#F79009'}
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className={kpi.trend === 'up' ? 'text-kp-success' : 'text-kp-warning'}>
                    {kpi.trend === 'up' ? '▲' : '▼'} {kpi.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Analytics Charts (complies with Design Tokens) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Stock Level & Movements Trend */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary">Stock Level Trend (Last 7 Days)</h3>
                <span className="text-xs font-semibold text-kp-text-tertiary">Units</span>
              </div>
              <div className="h-60 w-full flex items-end relative pt-4">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 text-[9px] text-kp-text-tertiary pb-6">
                  <div className="border-b border-dashed border-kp-border">1000 u</div>
                  <div className="border-b border-dashed border-kp-border">750 u</div>
                  <div className="border-b border-dashed border-kp-border">500 u</div>
                  <div className="border-b border-dashed border-kp-border">250 u</div>
                </div>
                <svg className="h-full w-full" viewBox="0 0 350 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 160 L50 140 L100 120 L150 110 L200 90 L250 95 L300 80 L350 40 L350 180 L0 180 Z"
                    fill="url(#chartGrad)"
                  />
                  <path
                    d="M0 160 L50 140 L100 120 L150 110 L200 90 L250 95 L300 80 L350 40"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-kp-text-tertiary mt-2">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            {/* Chart 2: Warehouse Utilization */}
            <div className="card">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary mb-4">Warehouse Capacity Breakdown</h3>
              <div className="space-y-4">
                {[
                  { name: 'Zone A (Fast Movers)', cap: 88, color: 'bg-kp-success' },
                  { name: 'Zone B (Bulk & Pallets)', cap: 94, color: 'bg-kp-danger' },
                  { name: 'Zone C (IoT & Hardware)', cap: 62, color: 'bg-kp-accent' },
                  { name: 'Zone D (Consumables)', cap: 45, color: 'bg-kp-info' }
                ].map((zone, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-kp-text-secondary">{zone.name}</span>
                      <span className="text-kp-text-primary">{zone.cap}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-kp-bg-tertiary rounded-full overflow-hidden">
                      <div className={`h-full ${zone.color}`} style={{ width: `${zone.cap}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: ABC Inventory Analysis */}
            <div className="card">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary mb-4">ABC Classification Analysis</h3>
              <div className="flex h-52 items-center justify-center">
                <svg className="h-40 w-44" viewBox="0 0 36 36">
                  {/* Segment A */}
                  <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--accent)" strokeWidth="4.5" strokeDasharray="70 30" strokeDashoffset="25" />
                  {/* Segment B */}
                  <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--warning)" strokeWidth="4.5" strokeDasharray="20 80" strokeDashoffset="-45" />
                  {/* Segment C */}
                  <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--success)" strokeWidth="4.5" strokeDasharray="10 90" strokeDashoffset="-65" />
                </svg>
              </div>
              <div className="flex justify-around text-[10px] font-bold text-kp-text-secondary mt-2">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-kp-accent"></span>A (70% Val)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-kp-warning"></span>B (20% Val)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-kp-success"></span>C (10% Val)</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. STOCK LEDGER (Table) */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row gap-3 items-stretch justify-between">
            <div className="flex flex-wrap gap-2.5 items-center flex-1">
              
              {/* Search */}
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-4 w-4 text-kp-text-tertiary" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="SKU, Barkod veya Ürün Adı Ara..."
                  className="block w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary pl-10 pr-4 py-2.5 text-xs shadow-sm focus:border-kp-accent focus:outline-none focus:ring-1 focus:ring-kp-accent"
                />
              </div>

              {/* Warehouse dropdown */}
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary text-xs font-semibold px-4 py-2.5 shadow-sm focus:outline-none"
              >
                <option value="All">Tüm Depolar</option>
                <option value="Istanbul Main">İstanbul Merkez Depo</option>
                <option value="Munich Transit">Münih Transit Depo</option>
              </select>

              {/* Status dropdown */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary text-xs font-semibold px-4 py-2.5 shadow-sm focus:outline-none"
              >
                <option value="All">Tüm Durumlar</option>
                <option value="Healthy">Sağlıklı</option>
                <option value="Low Stock">Düşük Stok</option>
                <option value="Critical">Kritik Seviye</option>
                <option value="Out of Stock">Stokta Yok</option>
                <option value="Overstock">Aşırı Stok</option>
              </select>
            </div>

            {/* Column toggling & Export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative group">
                <button className="inline-flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-secondary px-4 py-2.5 text-xs font-bold text-kp-text-secondary hover:bg-kp-bg-hover/30 transition-all">
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Sütunlar
                </button>
                <div className="absolute right-0 mt-1.5 hidden group-focus-within:block group-hover:block bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-dropdown p-3.5 z-20 w-48 text-xs space-y-2">
                  <span className="font-bold text-kp-text-tertiary block border-b border-kp-border pb-1.5 mb-1.5">Sütunları Göster/Gizle</span>
                  {Object.keys(visibleColumns).map(col => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer capitalize font-semibold text-kp-text-secondary">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col]}
                        onChange={() => toggleColumn(col)}
                        className="rounded border-kp-border text-kp-accent focus:ring-kp-accent h-3.5 w-3.5"
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => toast.info('Generating CSV export...')}
                className="inline-flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-secondary px-4 py-2.5 text-xs font-bold text-kp-text-secondary hover:bg-kp-bg-hover/30 shadow-sm transition-all"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                CSV Olarak Aktar
              </button>
            </div>
          </div>

          {/* Table Container using kroptos design system */}
          <div className="overflow-x-auto rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-card">
            <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
              <thead>
                <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30 select-none">
                  {visibleColumns.name && <th onClick={() => handleSort('name')} className="py-3 px-4 cursor-pointer hover:bg-kp-bg-hover transition-colors">Ürün Detayları</th>}
                  {visibleColumns.sku && <th onClick={() => handleSort('sku')} className="py-3 px-4 cursor-pointer hover:bg-kp-bg-hover transition-colors">SKU</th>}
                  {visibleColumns.warehouse && <th onClick={() => handleSort('warehouse')} className="py-3 px-4 cursor-pointer hover:bg-kp-bg-hover transition-colors">Depo & Raf Konumu</th>}
                  {visibleColumns.available && <th onClick={() => handleSort('available')} className="py-3 px-4 text-right cursor-pointer hover:bg-kp-bg-hover transition-colors">Kullanılabilir</th>}
                  {visibleColumns.reserved && <th onClick={() => handleSort('reserved')} className="py-3 px-4 text-right cursor-pointer hover:bg-kp-bg-hover transition-colors">Rezerve</th>}
                  {visibleColumns.incoming && <th onClick={() => handleSort('incoming')} className="py-3 px-4 text-right cursor-pointer hover:bg-kp-bg-hover transition-colors">Gelen</th>}
                  {visibleColumns.damaged && <th className="py-3 px-4 text-right">Hasarlı</th>}
                  {visibleColumns.status && <th onClick={() => handleSort('status')} className="py-3 px-4 cursor-pointer hover:bg-kp-bg-hover transition-colors">Durum</th>}
                  {visibleColumns.actions && <th className="py-3 px-4 text-center">İşlemler</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-kp-border">
                {sortedProducts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setIsDrawerOpen(true);
                    }}
                    className="hover:bg-kp-bg-hover/30 cursor-pointer transition-colors border-b border-kp-border"
                  >
                    {visibleColumns.name && (
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                           <img src={getProductImage(p.image)} alt={p.name} className="h-8 w-8 rounded-kp-md object-cover border border-kp-border" />
                          <div>
                            <div className="font-semibold text-kp-text-primary">{p.name}</div>
                            <div className="text-[10px] text-kp-text-tertiary">{p.brand} • {p.category}</div>
                          </div>
                        </div>
                      </td>
                    )}

                    {visibleColumns.sku && (
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-kp-text-primary">{p.sku}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{p.barcode}</div>
                      </td>
                    )}

                    {visibleColumns.warehouse && (
                      <td className="py-3.5 px-4">
                        <div className="text-kp-text-primary">{p.warehouse}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{p.location}</div>
                      </td>
                    )}

                    {visibleColumns.available && (
                      <td className="py-3.5 px-4 text-right font-bold text-kp-text-primary">
                        {p.available.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.reserved && (
                      <td className="py-3.5 px-4 text-right text-kp-warning">
                        {p.reserved}
                      </td>
                    )}
                    {visibleColumns.incoming && (
                      <td className="py-3.5 px-4 text-right text-kp-success">
                        {p.incoming}
                      </td>
                    )}
                    {visibleColumns.damaged && (
                      <td className="py-3.5 px-4 text-right text-kp-danger">
                        {p.damaged}
                      </td>
                    )}

                    {/* Status Badge */}
                    {visibleColumns.status && (
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide ${
                          p.status === 'Healthy' ? 'bg-kp-success-muted text-kp-success' :
                          p.status === 'Low Stock' ? 'bg-kp-warning-muted text-kp-warning' :
                          p.status === 'Critical' ? 'bg-kp-warning-muted text-kp-warning' :
                          p.status === 'Out of Stock' ? 'bg-kp-danger-muted text-kp-danger' :
                          p.status === 'Overstock' ? 'bg-kp-accent-muted text-kp-accent' :
                          'bg-kp-bg-tertiary text-kp-text-tertiary'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    )}

                    {/* Actions */}
                    {visibleColumns.actions && (
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setIsDrawerOpen(true);
                            }}
                            className="rounded-kp-md p-1.5 hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-text-primary"
                            title="View details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 3. WAREHOUSE MAP (Visual Grid) */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-kp-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary">Warehouse Grid Visualization</h3>
                <p className="text-[11px] text-kp-text-tertiary">Layout of Istanbul Main Warehouse. Click a bin location to view occupancy.</p>
              </div>
              <div className="mt-2 sm:mt-0 flex gap-2">
                <span className="flex items-center gap-1 text-[10px] font-bold text-kp-text-tertiary"><span className="h-3 w-3 rounded bg-kp-success"></span>&lt;60% Fill</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-kp-text-tertiary"><span className="h-3 w-3 rounded bg-kp-warning"></span>60%-90% Fill</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-kp-text-tertiary"><span className="h-3 w-3 rounded bg-kp-danger"></span>&gt;90% Overfill</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Zone A (Fast Movers)', aisles: ['Aisle A01', 'Aisle A02', 'Aisle A03'], fill: 82 },
                { name: 'Zone B (Bulk & Pallets)', aisles: ['Aisle B01', 'Aisle B02', 'Aisle B03'], fill: 94 },
                { name: 'Zone C (Electronics)', aisles: ['Aisle C01', 'Aisle C02'], fill: 55 },
                { name: 'Zone D (Cold Storage)', aisles: ['Aisle D01'], fill: 35 }
              ].map((zone, zIdx) => (
                <div key={zIdx} className="rounded-kp-lg border border-kp-border p-4 bg-kp-bg-primary/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-kp-text-secondary">{zone.name}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                      zone.fill > 90 ? 'bg-kp-danger-muted text-kp-danger' :
                      zone.fill > 60 ? 'bg-kp-warning-muted text-kp-warning' :
                      'bg-kp-success-muted text-kp-success'
                    }`}>{zone.fill}% Fill</span>
                  </div>

                  <div className="space-y-3">
                    {zone.aisles.map((aisle, aIdx) => (
                      <div key={aIdx} className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{aisle}</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[1, 2, 3, 4].map((rack) => {
                            const mockPercent = Math.floor(Math.random() * 60) + (zone.fill - 30);
                            return (
                              <button
                                key={rack}
                                onClick={() => {
                                  toast.info(`Location: ${zone.name} - ${aisle} - Rack ${rack} · Occupancy: ${mockPercent}%`);
                                }}
                                className={`h-8 rounded-kp-sm text-[9px] font-extrabold text-white flex items-center justify-center transition-all ${
                                  mockPercent > 90 ? 'bg-kp-danger hover:bg-kp-danger/80' :
                                  mockPercent > 60 ? 'bg-kp-warning hover:bg-kp-warning/80' :
                                  'bg-kp-success hover:bg-kp-success/80'
                                }`}
                              >
                                R{rack}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Quick Inbound Form */}
            <div className="card space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary flex items-center gap-1.5">
                <InboxArrowDownIcon className="h-5 w-5 text-kp-accent" />
                Register Stock Movement
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const sku = (form.elements.namedItem('sku') as HTMLInputElement).value;
                  const qty = parseInt((form.elements.namedItem('qty') as HTMLInputElement).value);
                  const type = (form.elements.namedItem('type') as HTMLSelectElement).value as any;
                  
                  const targetProd = products.find(p => p.sku === sku);
                  if (targetProd) {
                    try {
                      await apiFetch('/inventory/adjust', {
                        method: 'POST',
                        body: JSON.stringify({
                          productId: (targetProd as any).productId || targetProd.id,
                          type: type,
                          quantity: qty,
                          reason: 'Manual adjustment via Stock Movements form'
                        })
                      });
                      
                      toast.success('Movement applied successfully!');
                      form.reset();
                      
                      // Refresh database state
                      fetchInventory();
                      fetchMovements();
                    } catch (err) {
                      console.error('Failed to submit adjustment:', err);
                      toast.error('Failed to register stock movement. Please check context or permissions.');
                    }
                  }
                }}
                className="space-y-4 text-xs font-semibold text-kp-text-secondary"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">SKU</label>
                  <select name="sku" className="block w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary px-3 py-2 focus:outline-none">
                    {products.map(p => (
                      <option key={p.id} value={p.sku}>{p.sku} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Qty</label>
                    <input type="number" name="qty" required min="1" defaultValue="10" className="block w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary px-3.5 py-2" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Type</label>
                    <select name="type" className="block w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary px-3 py-2.5 focus:outline-none">
                      <option value="Inbound">Inbound</option>
                      <option value="Outbound">Outbound</option>
                      <option value="Damage">Damage</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-kp-accent hover:bg-kp-accent-hover text-white text-xs font-bold rounded-kp-md transition-all shadow-sm">
                  Apply Movement
                </button>
              </form>
            </div>

            {/* Movement logs */}
            <div className="lg:col-span-2 card space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary">Recent Stock Movements Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-kp-text-secondary">
                  <thead>
                    <tr className="border-b border-kp-border text-[10px] text-kp-text-tertiary uppercase tracking-wider">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">SKU & Item</th>
                      <th className="py-2.5">Type</th>
                      <th className="py-2.5 text-right">Before</th>
                      <th className="py-2.5 text-right">After</th>
                      <th className="py-2.5 text-right">Diff</th>
                      <th className="py-2.5">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kp-border text-kp-text-primary">
                    {movements.map((m, idx) => (
                      <tr key={idx} className="hover:bg-kp-bg-hover/30">
                        <td className="py-3">
                          <div className="font-bold text-kp-text-primary">{m.id}</div>
                          <div className="text-[10px] text-kp-text-tertiary">{m.createdAt}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-kp-text-primary">{m.sku}</div>
                          <div className="text-[10px] text-kp-text-tertiary max-w-[180px] truncate">{m.name}</div>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            m.type === 'Inbound' ? 'bg-kp-success-muted text-kp-success' :
                            m.type === 'Outbound' ? 'bg-kp-warning-muted text-kp-warning' :
                            m.type === 'Damage' ? 'bg-kp-danger-muted text-kp-danger' :
                            'bg-kp-accent-muted text-kp-accent'
                          }`}>{m.type}</span>
                        </td>
                        <td className="py-3 text-right">{m.beforeQty}</td>
                        <td className="py-3 text-right">{m.afterQty}</td>
                        <td className={`py-3 text-right font-bold ${m.difference > 0 ? 'text-kp-success' : 'text-kp-danger'}`}>
                          {m.difference > 0 ? `+${m.difference}` : m.difference}
                        </td>
                        <td className="py-3 text-kp-text-tertiary text-[10px]">{m.performedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: 5. REPLENISHMENT */}
      {activeTab === 'lowstock' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex justify-between items-center border-b border-kp-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary">Replenishment Recommendations</h3>
                <p className="text-[11px] text-kp-text-tertiary">Economic Order Quantity (EOQ) and automatic purchase triggers for low-stock items.</p>
              </div>
              <span className="rounded-full bg-kp-warning-muted px-3 py-1 text-xs font-bold text-kp-warning uppercase">
                {lowStockCount} Low Items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-kp-text-secondary">
                <thead>
                  <tr className="border-b border-kp-border text-[10px] text-kp-text-tertiary uppercase tracking-wider">
                    <th className="py-3">SKU & Product</th>
                    <th className="py-3">Available</th>
                    <th className="py-3">Safety Stock</th>
                    <th className="py-3">Reorder Point</th>
                    <th className="py-3 text-center">Class</th>
                    <th className="py-3 text-right">EOQ</th>
                    <th className="py-3 text-right">Lead Time</th>
                    <th className="py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kp-border text-kp-text-primary">
                  {products.filter(p => p.available <= p.reorderPoint).map((p, idx) => (
                    <tr key={idx} className="hover:bg-kp-bg-hover/30">
                      <td className="py-3.5">
                        <div className="font-bold text-kp-text-primary">{p.sku}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{p.name}</div>
                      </td>
                      <td className="py-3.5 font-bold text-kp-danger">{p.available} units</td>
                      <td className="py-3.5 text-kp-text-tertiary">{p.safetyStock}</td>
                      <td className="py-3.5 text-kp-text-primary font-bold">{p.reorderPoint}</td>
                      <td className="py-3.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-kp-accent-muted text-kp-accent font-extrabold">{p.abcClass}</span>
                      </td>
                      <td className="py-3.5 text-right font-extrabold text-kp-text-primary">
                        {p.abcClass === 'A' ? 250 : 100} units
                      </td>
                      <td className="py-3.5 text-right text-kp-text-tertiary">4 Days</td>
                      <td className="py-3.5 text-center">
                        <button
                          onClick={() => toast.success(`PO drafted for SKU ${p.sku}`)}
                          className="px-3 py-1.5 bg-kp-accent hover:bg-kp-accent-hover text-white text-[10px] font-bold rounded-kp-md transition-all"
                        >
                          Draft PO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 6. INVENTORY COUNTING */}
      {activeTab === 'counting' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Start Count */}
            <div className="card space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary flex items-center gap-1.5">
                <AdjustmentsHorizontalIcon className="h-5 w-5 text-kp-accent" />
                Initiate Stock Count
              </h3>
              <p className="text-[11px] text-kp-text-tertiary leading-relaxed">
                Create full warehouse audits, barcode checks, or category-based cycle counts for operators.
              </p>
              
              <div className="space-y-2">
                {[
                  { name: 'Cycle Count (Aisle A)', type: 'Cycle', items: '20 SKUs' },
                  { name: 'Blind Count (Fast Movers)', type: 'Blind', items: '5 SKUs' }
                ].map((audit, idx) => (
                  <div key={idx} className="flex justify-between items-center rounded-kp-md border border-kp-border p-3 bg-kp-bg-primary/30">
                    <div>
                      <div className="font-bold text-xs text-kp-text-primary">{audit.name}</div>
                      <div className="text-[10px] text-kp-text-tertiary">{audit.type} • {audit.items}</div>
                    </div>
                    <button
                      onClick={() => toast.info(`Started: ${audit.name}`)}
                      className="px-3 py-1.5 border border-kp-border rounded-kp-md hover:bg-kp-bg-hover text-[10px] text-kp-text-primary font-bold"
                    >
                      Start
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Approvals queue */}
            <div className="lg:col-span-2 card space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary">Discrepancy Approvals Queue</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-kp-text-secondary">
                  <thead>
                    <tr className="border-b border-kp-border text-[10px] text-kp-text-tertiary uppercase tracking-wider">
                      <th className="py-2.5">Audit ID</th>
                      <th className="py-2.5">SKU & Item</th>
                      <th className="py-2.5 text-right">System Qty</th>
                      <th className="py-2.5 text-right">Counted Qty</th>
                      <th className="py-2.5 text-right">Difference</th>
                      <th className="py-2.5 text-center">Status</th>
                      <th className="py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kp-border text-kp-text-primary">
                    {auditCounts.map((c, idx) => (
                      <tr key={idx} className="hover:bg-kp-bg-hover/30">
                        <td className="py-3 font-bold text-kp-text-primary">{c.id}</td>
                        <td className="py-3">
                          <div className="font-bold text-kp-text-primary">{c.sku}</div>
                          <div className="text-[10px] text-kp-text-tertiary">{c.name}</div>
                        </td>
                        <td className="py-3 text-right">{c.systemQty}</td>
                        <td className="py-3 text-right">{c.countedQty}</td>
                        <td className={`py-3 text-right font-bold ${c.diff === 0 ? 'text-kp-text-tertiary' : c.diff > 0 ? 'text-kp-success' : 'text-kp-danger'}`}>
                          {c.diff === 0 ? '0' : c.diff > 0 ? `+${c.diff}` : c.diff}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            c.status === 'Matched' ? 'bg-kp-success-muted text-kp-success' : 'bg-kp-warning-muted text-kp-warning'
                          }`}>{c.status}</span>
                        </td>
                        <td className="py-3 text-center">
                          {c.status !== 'Matched' ? (
                            <button
                              onClick={() => {
                                setProducts(prev => prev.map(p => p.sku === c.sku ? { ...p, available: c.countedQty } : p));
                                setAuditCounts(prev => prev.map(item => item.id === c.id ? { ...item, status: 'Matched' } : item));
                                toast.success('Discrepancy approved!');
                              }}
                              className="px-2.5 py-1 bg-kp-success hover:bg-kp-success/80 text-white rounded-kp-md text-[10px] font-bold"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-kp-text-tertiary text-[10px]">Approved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: 7. RESERVATIONS */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex justify-between items-center border-b border-kp-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary">Stock Reservations</h3>
                <p className="text-[11px] text-kp-text-tertiary">Track allocations reserved by marketplace orders, integrations, or manual locking.</p>
              </div>
              <span className="text-xs text-kp-text-tertiary font-bold">Total Allocated: {reservedQtyVal} Units</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-kp-text-secondary">
                <thead>
                  <tr className="border-b border-kp-border text-[10px] text-kp-text-tertiary uppercase tracking-wider">
                    <th className="py-2.5">Reference</th>
                    <th className="py-2.5">SKU / Item</th>
                    <th className="py-2.5 text-center">Source</th>
                    <th className="py-2.5 text-right">Qty</th>
                    <th className="py-2.5">Priority</th>
                    <th className="py-2.5">Expiration</th>
                    <th className="py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kp-border text-kp-text-primary">
                  {[
                    { ref: 'RES-87162', sku: 'WMS-901-WHT', name: 'Industrial Pallet Wrapper Roll (Film)', source: 'Shopify Store', qty: 200, priority: 'High', expires: '2026-07-05' },
                    { ref: 'RES-10298', sku: 'WMS-101-BLK', name: 'Wireless Barcode Scanner Pro', source: 'Trendyol API', qty: 35, priority: 'Normal', expires: '2026-07-04' }
                  ].map((res, idx) => (
                    <tr key={idx} className="hover:bg-kp-bg-hover/30">
                      <td className="py-3 font-bold text-kp-text-primary">{res.ref}</td>
                      <td className="py-3">
                        <div className="font-bold text-kp-text-primary">{res.sku}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{res.name}</div>
                      </td>
                      <td className="py-3 text-center">
                        <span className="rounded bg-kp-bg-primary/50 px-2 py-0.5 text-[10px] font-bold text-kp-text-secondary">
                          {res.source}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-kp-text-primary">{res.qty}</td>
                      <td className="py-3">
                        <span className={`text-[10px] font-extrabold ${
                          res.priority === 'High' ? 'text-kp-warning' : 'text-kp-accent'
                        }`}>{res.priority}</span>
                      </td>
                      <td className="py-3 text-kp-text-tertiary text-[10px]">{res.expires}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => {
                            setProducts(prev => prev.map(p => p.sku === res.sku ? { ...p, reserved: Math.max(0, p.reserved - res.qty) } : p));
                            toast.success('Allocation released.');
                          }}
                          className="px-2.5 py-1.5 border border-kp-danger/30 text-kp-danger hover:bg-kp-danger-muted/10 rounded-kp-md text-[10px] font-bold transition-colors"
                        >
                          Release
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 8. INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Logo ERP Integration', logo: 'L', sync: 'Successful', time: '10 mins ago', color: 'bg-orange-500' },
              { name: 'Trendyol Partner API', logo: 'T', sync: 'Successful', time: '12 mins ago', color: 'bg-orange-600' },
              { name: 'Shopify Store Connect', logo: 'S', sync: 'Successful', time: '30 mins ago', color: 'bg-green-600' },
              { name: 'Amazon Central API', logo: 'A', sync: 'Pending', time: 'Waiting for queue', color: 'bg-yellow-600' }
            ].map((channel, idx) => (
              <div key={idx} className="card flex flex-col justify-between space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-kp-md ${channel.color} text-white flex items-center justify-center font-extrabold text-sm`}>
                    {channel.logo}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-kp-text-primary">{channel.name}</h4>
                    <span className="text-[10px] text-kp-text-tertiary">Sales Channel Sync</span>
                  </div>
                </div>

                <div className="border-t border-kp-border pt-3 flex items-center justify-between text-xs font-semibold">
                  <div>
                    <span className="text-kp-text-tertiary block text-[9px] uppercase tracking-wider">Sync Status</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold ${
                      channel.sync === 'Successful' ? 'text-kp-success' : 'text-kp-warning'
                    }`}>
                      ● {channel.sync}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-kp-text-tertiary block text-[9px] uppercase tracking-wider">Last Sync</span>
                    <span className="text-kp-text-primary text-[11px]">{channel.time}</span>
                  </div>
                </div>

                <button
                  onClick={() => toast.info(`Sync triggered for: ${channel.name}`)}
                  className="w-full py-2 bg-kp-bg-primary hover:bg-kp-bg-hover border border-kp-border rounded-kp-md text-[10px] font-bold transition-all text-kp-text-secondary"
                >
                  Force Sync
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 9. AI INSIGHTS */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* AI Banner - Gradient matches accents, text matches text-kp-text-primary */}
          <div className="card bg-gradient-to-r from-kp-accent/10 to-kp-accent-muted/20 text-kp-text-primary border border-kp-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-kp-accent animate-pulse" />
                <h3 className="text-base font-bold text-kp-text-primary">KroptOS AI Inventory Copilot</h3>
              </div>
              <p className="text-xs text-kp-text-secondary max-w-2xl leading-relaxed">
                Predictive demand modeling, stockout risk assessments, and automatic safety levels optimized continuously based on historical rotation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Stockout Risk Card */}
            <div className="card space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary flex items-center gap-1.5">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-warning" />
                Forecasted Stockout Risks
              </h4>
              <div className="space-y-3">
                {[
                  { sku: 'WMS-402-BLU', name: 'Thermal Shipping Label Printer', days: '3 Days', risk: 'Critical', action: 'PO needs placement today' },
                  { sku: 'WMS-108-SLV', name: 'Heavy-Duty Forklift Camera System', days: '8 Days', risk: 'Medium', action: 'Monitor inbound transit' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/30 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-kp-text-primary">{item.sku} • {item.name}</div>
                      <div className="text-[10px] text-kp-text-tertiary">Action: {item.action}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-kp-danger font-bold block">Stockout in {item.days}</span>
                      <span className="text-[9px] bg-kp-danger-muted text-kp-danger px-1.5 py-0.5 rounded font-bold uppercase">{item.risk}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations Card */}
            <div className="card space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary flex items-center gap-1.5">
                <CpuChipIcon className="h-5 w-5 text-kp-accent" />
                Optimization Recommendations
              </h4>
              <div className="space-y-4">
                <div className="flex gap-3 text-xs">
                  <span className="h-5 w-5 rounded-full bg-kp-success-muted text-kp-success flex items-center justify-center font-bold">✓</span>
                  <div>
                    <h5 className="font-bold text-kp-text-primary">Dead stock detected</h5>
                    <p className="text-[11px] text-kp-text-tertiary mt-0.5">WMS-901-WHT (wrapper Film) has high available stock with 0 movements in 45 days. Suggest running promo or reducing safety stock threshold to 30 units.</p>
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="h-5 w-5 rounded-full bg-kp-accent-muted text-kp-accent flex items-center justify-center font-bold">✓</span>
                  <div>
                    <h5 className="font-bold text-kp-text-primary">Location congestion optimization</h5>
                    <p className="text-[11px] text-kp-text-tertiary mt-0.5">Aisle B is experiencing 94% occupancy. Relocate low-priority category items to Munich Transit to maintain pick speeds.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: 10. ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-primary">System Alerts</h3>
            
            <div className="space-y-2.5">
              {alerts.map((alertItem) => (
                <div
                  key={alertItem.id}
                  className={`flex gap-3 items-start p-4 rounded-kp-md border text-xs font-semibold ${
                    alertItem.severity === 'critical' ? 'bg-kp-danger-muted/10 border-kp-danger/30 text-kp-danger' :
                    alertItem.severity === 'warning' ? 'bg-kp-warning-muted/10 border-kp-warning/30 text-kp-warning' :
                    'bg-kp-info-muted/10 border-kp-info/30 text-kp-info'
                  }`}
                >
                  <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 flex flex-col sm:flex-row sm:justify-between">
                    <span>{alertItem.message}</span>
                    <span className="text-[10px] text-kp-text-tertiary whitespace-nowrap mt-1 sm:mt-0">{alertItem.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED SLIDE OVER DRAWER */}
      {isDrawerOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50 animate-fade-in">
          <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
          
          <div className="w-full max-w-xl bg-kp-bg-secondary shadow-kp-dropdown h-full flex flex-col justify-between overflow-y-auto">
            
            <div className="p-6 border-b border-kp-border flex justify-between items-start">
              <div className="flex items-center gap-3">
                 <img src={getProductImage(selectedProduct.image)} alt={selectedProduct.name} className="h-10 w-10 rounded-kp-md object-cover border border-kp-border" />
                <div>
                  <h3 className="font-bold text-sm text-kp-text-primary">{selectedProduct.name}</h3>
                  <p className="text-[10px] text-kp-text-tertiary font-extrabold uppercase tracking-wider">{selectedProduct.sku}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-kp-bg-hover flex items-center justify-center font-bold text-kp-text-tertiary hover:text-kp-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-kp-border text-xs font-bold tracking-wider uppercase px-4">
              {[
                { id: 'details', label: 'Detaylar' },
                { id: 'locations', label: 'Konumlar' },
                { id: 'reservations', label: 'Rezervasyonlar' },
                { id: 'movements', label: 'Geçmiş' },
                { id: 'ai', label: 'AI Analizi' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDrawerSubTab(t.id as any)}
                  className={`px-4 py-3 border-b-2 transition-colors ${
                    drawerSubTab === t.id ? 'border-kp-accent text-kp-accent' : 'border-transparent text-kp-text-tertiary hover:text-kp-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 p-6 space-y-6 text-xs text-kp-text-secondary">
              
              {drawerSubTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-kp-text-tertiary uppercase">Barkod</span>
                      <div className="text-kp-text-primary font-semibold mt-0.5">{selectedProduct.barcode}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-kp-text-tertiary uppercase">Marka</span>
                      <div className="text-kp-text-primary font-semibold mt-0.5">{selectedProduct.brand}</div>
                    </div>
                  </div>

                  <div className="border-t border-kp-border pt-4 space-y-2">
                    <h4 className="font-bold text-kp-text-primary uppercase tracking-wider text-[10px]">Stok Yapılandırması</h4>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded bg-kp-bg-primary/50">
                        <span className="text-[9px] text-kp-text-tertiary block uppercase">Min</span>
                        <span className="font-bold text-kp-text-primary">{selectedProduct.minStock}</span>
                      </div>
                      <div className="p-2 rounded bg-kp-bg-primary/50">
                        <span className="text-[9px] text-kp-text-tertiary block uppercase">Max</span>
                        <span className="font-bold text-kp-text-primary">{selectedProduct.maxStock}</span>
                      </div>
                      <div className="p-2 rounded bg-kp-bg-primary/50">
                        <span className="text-[9px] text-kp-text-tertiary block uppercase">Sipariş Sınırı</span>
                        <span className="font-bold text-kp-text-primary">{selectedProduct.reorderPoint}</span>
                      </div>
                      <div className="p-2 rounded bg-kp-bg-primary/50">
                        <span className="text-[9px] text-kp-text-tertiary block uppercase">Emniyet</span>
                        <span className="font-bold text-kp-text-primary">{selectedProduct.safetyStock}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerSubTab === 'locations' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-kp-md border border-kp-border bg-kp-bg-primary/30 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-kp-text-primary">{selectedProduct.warehouse}</div>
                      <div className="text-[10px] text-kp-text-tertiary">{selectedProduct.location}</div>
                    </div>
                    <span className="font-bold text-kp-text-primary">{selectedProduct.available} adet</span>
                  </div>
                </div>
              )}

              {drawerSubTab === 'reservations' && (
                <div className="space-y-3">
                  {selectedProduct.reserved > 0 ? (
                    <div className="flex justify-between items-center p-3 rounded bg-kp-bg-primary/50 text-xs font-semibold text-kp-text-primary">
                      <span>Shopify Mağaza Senkronizasyon Kilidi</span>
                      <span className="text-kp-warning font-bold">{selectedProduct.reserved} adet</span>
                    </div>
                  ) : (
                    <p className="text-xs text-kp-text-tertiary italic text-center py-4">Aktif rezerve stok bulunmuyor.</p>
                  )}
                </div>
              )}

              {drawerSubTab === 'movements' && (
                <div className="space-y-2">
                  {movements.filter(m => m.sku === selectedProduct.sku).map((m, idx) => (
                    <div key={idx} className="p-3 border border-kp-border rounded bg-kp-bg-primary/30 text-xs font-semibold flex justify-between items-center">
                      <div>
                        <div className="font-bold text-kp-text-primary">{m.type}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{m.createdAt} • {m.performedBy}</div>
                      </div>
                      <span className={`font-bold ${m.difference > 0 ? 'text-kp-success' : 'text-kp-danger'}`}>
                        {m.difference > 0 ? `+${m.difference}` : m.difference}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {drawerSubTab === 'ai' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-kp-md bg-kp-accent-muted/10 border border-kp-accent/20 text-kp-text-primary space-y-2">
                    <div className="flex items-center gap-1.5">
                      <SparklesIcon className="h-5 w-5 text-kp-accent animate-pulse" />
                      <h4 className="font-bold text-xs">AI Tahmin Skoru: %94</h4>
                    </div>
                    <p className="text-[11px] leading-relaxed text-kp-text-secondary">
                      Stok devir hızı YÜKSEK. Stok tükenmesini önlemek için 2026-07-05 tarihinde 250 adetlik stok ikmal siparişi (PO) verilmesi önerilir.
                    </p>
                  </div>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-kp-border bg-kp-bg-primary/30 flex justify-end gap-2">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 text-xs font-bold text-kp-text-tertiary hover:text-kp-text-primary"
              >
                Paneli Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK INBOUND MODAL */}
      {isInboundModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary rounded-kp-lg p-6 shadow-kp-dropdown border border-kp-border space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-kp-border pb-3">
              <h3 className="font-bold text-sm text-kp-text-primary">Hızlı Mal Kabul Girişi Oluştur</h3>
              <button onClick={() => setIsInboundModalOpen(false)} className="text-kp-text-tertiary hover:text-kp-text-primary font-bold">✕</button>
            </div>
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const poRef = (form.elements.namedItem('poRef') as HTMLInputElement).value;
                try {
                  if (products.length > 0) {
                    await apiFetch('/inventory/adjust', {
                      method: 'POST',
                      body: JSON.stringify({
                        productId: (products[0] as any).productId || products[0].id,
                        type: 'Inbound',
                        quantity: 50,
                        reason: `Quick PO Inbound received: ${poRef}`
                      })
                    });
                    fetchInventory();
                    fetchMovements();
                  }
                  toast.success(`PO Giriş Sevkiyatı ${poRef} başarıyla kaydedildi!`);
                } catch (err) {
                  console.error('Failed to register PO inbound:', err);
                }
                setIsInboundModalOpen(false);
              }}
              className="space-y-4 text-xs font-semibold text-kp-text-secondary"
            >
              <div>
                <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Hedef Depo</label>
                <select className="w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary px-3 py-2 focus:outline-none">
                  <option>İstanbul Merkez Depo</option>
                  <option>Münih Transit Deposu</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-1">Referans Sipariş (PO) Numarası</label>
                <input type="text" name="poRef" placeholder="PO-2026-X" required className="w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary text-kp-text-primary px-3.5 py-2 focus:outline-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsInboundModalOpen(false)} className="px-4 py-2 border border-kp-border rounded-kp-md text-kp-text-secondary font-bold hover:bg-kp-bg-hover">
                  İptal
                </button>
                <button type="submit" className="px-4 py-2 bg-kp-accent hover:bg-kp-accent-hover text-white rounded-kp-md font-bold shadow-sm">
                  Mal Kabulü Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
