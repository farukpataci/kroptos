'use client';

import { useState } from 'react';
import { AnalyticsOverview } from './components/AnalyticsOverview';
import { SalesAnalytics } from './components/SalesAnalytics';
import { OrdersAnalytics } from './components/OrdersAnalytics';
import { ProfitabilityAnalytics } from './components/ProfitabilityAnalytics';
import { AnalyticsFilters } from './components/AnalyticsFilters';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({});

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics & Reports</h2>
        <div className="flex items-center space-x-2">
          {/* Export Button will go here */}
        </div>
      </div>

      <AnalyticsFilters onFilterChange={handleFilterChange} />

      <div className="w-full">
        <div className="flex space-x-1 border-b mb-4 overflow-x-auto pb-px">
          {['overview', 'sales', 'orders', 'products', 'marketplaces', 'inventory', 'shipping', 'profitability'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'overview' && <AnalyticsOverview filters={filters} />}
          {activeTab === 'sales' && <SalesAnalytics filters={filters} />}
          {activeTab === 'orders' && <OrdersAnalytics filters={filters} />}
          {activeTab === 'profitability' && <ProfitabilityAnalytics filters={filters} />}
          {/* Other tabs can be added similarly, reusing existing card/chart patterns */}
          {['products', 'marketplaces', 'inventory', 'shipping'].includes(activeTab) && (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} panel is under construction.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
