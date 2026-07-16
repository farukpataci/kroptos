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
  { id: 'general', label: 'General Settings' },
  { id: 'warehouses', label: 'Warehouses' },
  { id: 'zones', label: 'Zones' },
  { id: 'locations', label: 'Racks & Locations' },
  { id: 'source', label: 'Stock Source' },
  { id: 'allocation', label: 'Stock Allocation Rules' },
  { id: 'marketplace', label: 'Marketplace Stock Rules' },
  { id: 'logo', label: 'Logo / ERP Stock Integration' },
  { id: 'critical', label: 'Critical Stock & Alerts' },
  { id: 'movements', label: 'Stock Movements & Logs' },
];

export default function WarehousesPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Warehouse & Stock Allocation Settings</h2>
        <p className="text-gray-500">Configure warehouses, zones, and stock allocation rules.</p>
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
