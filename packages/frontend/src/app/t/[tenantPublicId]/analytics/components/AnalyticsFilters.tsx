'use client';

import { useState } from 'react';

export function AnalyticsFilters({ onFilterChange }: { onFilterChange: (filters: any) => void }) {
  const [dateRange, setDateRange] = useState('7d');

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDateRange(val);
    onFilterChange({ dateRange: val });
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center mb-6">
      <div className="flex flex-col">
        <label className="text-xs font-semibold text-gray-500 mb-1">Date Range</label>
        <select 
          value={dateRange} 
          onChange={handleDateChange}
          className="border-gray-300 rounded-md text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-gray-500 mb-1">Marketplace</label>
        <select className="border-gray-300 rounded-md text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="all">All</option>
          <option value="trendyol">Trendyol</option>
          <option value="hepsiburada">Hepsiburada</option>
          <option value="amazon">Amazon</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-gray-500 mb-1">Category</label>
        <select className="border-gray-300 rounded-md text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="all">All</option>
          <option value="electronics">Electronics</option>
          <option value="fashion">Fashion</option>
        </select>
      </div>

      <div className="flex-1"></div>
      
      <button className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition">
        Clear Filters
      </button>
    </div>
  );
}
