'use client';

import { useState } from 'react';
import { GeneralWarehouseSettingsForm } from './components/GeneralWarehouseSettingsForm';
import { WarehousesTable } from './components/WarehousesTable';
import { WarehouseZonesTable } from './components/WarehouseZonesTable';
import { WarehouseLocationsTable } from './components/WarehouseLocationsTable';
import { StockSourceSelector } from './components/StockSourceSelector';
import { StockAllocationRulesTable } from './components/StockAllocationRulesTable';
import { MarketplaceStockRulesTable } from './components/MarketplaceStockRulesTable';
import { LogoStockSettingsForm } from './components/LogoStockSettingsForm';
import { CriticalStockSettingsForm } from './components/CriticalStockSettingsForm';
import { StockMovementsTable } from './components/StockMovementsTable';

const tabs = [
  { id: 'general', label: 'Genel Ayarlar' },
  { id: 'warehouses', label: 'Depolar' },
  { id: 'zones', label: 'Bölgeler' },
  { id: 'locations', label: 'Raflar & Adresler' },
  { id: 'source', label: 'Stok Kaynağı' },
  { id: 'allocation', label: 'Stok Dağıtım Kuralları' },
  { id: 'marketplace', label: 'Pazaryeri Stok Kuralları' },
  { id: 'logo', label: 'Logo / ERP Stok Entegrasyonu' },
  { id: 'critical', label: 'Kritik Stok & Uyarılar' },
  { id: 'movements', label: 'Stok Hareketleri & Günlükler' },
];

export default function WarehousesPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Depo & Stok Dağıtım Ayarları</h2>
        <p className="text-gray-500">Depoları, bölgeleri ve stok dağıtım kurallarını yapılandırın.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Navigation Tabs */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Panel */}
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
          {activeTab === 'general' && <GeneralWarehouseSettingsForm />}
          {activeTab === 'warehouses' && <WarehousesTable />}
          {activeTab === 'zones' && <WarehouseZonesTable />}
          {activeTab === 'locations' && <WarehouseLocationsTable />}
          {activeTab === 'source' && <StockSourceSelector />}
          {activeTab === 'allocation' && <StockAllocationRulesTable />}
          {activeTab === 'marketplace' && <MarketplaceStockRulesTable />}
          {activeTab === 'logo' && <LogoStockSettingsForm />}
          {activeTab === 'critical' && <CriticalStockSettingsForm />}
          {activeTab === 'movements' && <StockMovementsTable />}
        </div>
      </div>
    </div>
  );
}
