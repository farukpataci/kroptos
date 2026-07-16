'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch(url);

function KpiCard({ title, data, format = 'number' }: { title: string, data: any, format?: 'number' | 'currency' | 'percent' }) {
  if (!data) return <div className="animate-pulse bg-gray-100 h-24 rounded-xl"></div>;
  
  const isPositive = data.trend === 'up';
  const isNeutral = data.trend === 'neutral';
  
  let formattedValue = data.value;
  if (format === 'currency') formattedValue = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(data.value);
  else if (format === 'percent') formattedValue = `${data.value}%`;
  else formattedValue = new Intl.NumberFormat('tr-TR').format(data.value);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{formattedValue}</span>
      </div>
      <div className="mt-2 flex items-center text-sm">
        {isNeutral ? (
          <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-xs">No change</span>
        ) : (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center ${isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(data.change)}%
          </span>
        )}
        <span className="text-gray-400 ml-2 text-xs">from last period</span>
      </div>
    </div>
  );
}

export function AnalyticsOverview({ filters }: { filters: any }) {
  // Serialize filters for query string
  const queryString = new URLSearchParams(filters).toString();
  const { data, error, isLoading } = useSWR<any>(`/analytics/overview?${queryString}`, fetcher);

  if (error) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Failed to load data.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Revenue" data={data?.totalRevenue} format="currency" />
        <KpiCard title="Net Revenue" data={data?.netRevenue} format="currency" />
        <KpiCard title="Total Orders" data={data?.totalOrders} format="number" />
        <KpiCard title="Avg. Order Value" data={data?.avgOrderValue} format="currency" />
        
        <KpiCard title="Items Sold" data={data?.itemsSold} format="number" />
        <KpiCard title="Gross Profit" data={data?.grossProfit} format="currency" />
        <KpiCard title="Profit Margin" data={data?.profitMargin} format="percent" />
        <KpiCard title="Return Rate" data={data?.returnRate} format="percent" />
        
        <KpiCard title="Active Marketplaces" data={data?.activeMarketplaces} format="number" />
        <KpiCard title="Integration Success" data={data?.integrationSuccess} format="percent" />
        <KpiCard title="Transfer Errors" data={data?.transferErrors} format="number" />
        <KpiCard title="Critical Stock" data={data?.criticalStockCount} format="number" />
      </div>
    </div>
  );
}
