'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GeneralWarehouseSettingsForm } from './components/GeneralWarehouseSettingsForm';
import { WarehousesTable } from './components/WarehousesTable';
import { WarehouseZonesTable } from './components/WarehouseZonesTable';
import { WarehouseLocationsTable } from './components/WarehouseLocationsTable';
import { StockAllocationRulesTable } from './components/StockAllocationRulesTable';
import { MarketplaceStockRulesTable } from './components/MarketplaceStockRulesTable';
import { LogoStockSettingsForm } from './components/LogoStockSettingsForm';
import { CriticalStockSettingsForm } from './components/CriticalStockSettingsForm';
import { StockMovementsTable } from './components/StockMovementsTable';

const tabs = [
  { id: 'general', labelKey: 'tabs.general' },
  { id: 'warehouses', labelKey: 'tabs.warehouses' },
  { id: 'zones', labelKey: 'tabs.zones' },
  { id: 'locations', labelKey: 'tabs.locations' },
  { id: 'allocation', labelKey: 'tabs.allocation' },
  { id: 'marketplace', labelKey: 'tabs.marketplace' },
  { id: 'logo', labelKey: 'tabs.logo' },
  { id: 'critical', labelKey: 'tabs.critical' },
  { id: 'movements', labelKey: 'tabs.movements' },
];

export default function WarehousesPage() {
  const t = useTranslations('warehouses');
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-6 mt-6">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          {/* Nine tabs do not fit a narrow viewport; they scroll sideways
              rather than wrapping into a block that pushes the panel down. */}
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Panel */}
        <div className="w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
          {activeTab === 'general' && <GeneralWarehouseSettingsForm />}
          {activeTab === 'warehouses' && <WarehousesTable />}
          {activeTab === 'zones' && <WarehouseZonesTable />}
          {activeTab === 'locations' && <WarehouseLocationsTable />}
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
