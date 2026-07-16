'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fetcher = (url: string) => apiFetch(url);

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];

export function ProfitabilityAnalytics({ filters }: { filters: any }) {
  const queryString = new URLSearchParams(filters).toString();
  const { data, error, isLoading } = useSWR<any>(`/analytics/profitability?${queryString}`, fetcher);

  if (isLoading) return <div className="animate-pulse bg-white h-[400px] rounded-xl border border-gray-100"></div>;
  
  if (error?.message?.includes('Forbidden') || error?.message?.includes('permission')) {
    return (
      <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center justify-center flex-col text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 text-xl">🔒</div>
        <h3 className="text-lg font-bold text-red-900 mb-2">Unauthorized Access</h3>
        <p className="text-red-700 max-w-md">You need the "analytics.financial.read" permission to view profitability and financial reports.</p>
      </div>
    );
  }

  if (error || !data) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Failed to load financial data.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Net Revenue</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900">₺{data.netRevenue.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Net Profit</h3>
          <p className="mt-2 text-2xl font-bold text-emerald-600">₺{data.netProfit.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Profit Margin</h3>
          <p className="mt-2 text-2xl font-bold text-emerald-600">%{data.margin}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Cost Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.costDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.costDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `₺${value?.toLocaleString('tr-TR')}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Financial Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Gross Revenue</span>
              <span className="font-medium text-gray-900">₺{data.grossRevenue.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Returns & Cancellations</span>
              <span className="font-medium text-red-600">-₺{(data.returnsAmount + data.cancellationsAmount).toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b bg-gray-50 px-2 rounded">
              <span className="font-semibold text-gray-800">Net Revenue</span>
              <span className="font-bold text-gray-900">₺{data.netRevenue.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Marketplace Commissions</span>
              <span className="font-medium text-red-600">-₺{data.marketplaceCommissions.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Shipping Costs</span>
              <span className="font-medium text-red-600">-₺{data.shippingCosts.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Cost of Goods Sold (COGS)</span>
              <span className="font-medium text-red-600">-₺{data.cogs.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-emerald-50 px-3 rounded-lg mt-4">
              <span className="font-bold text-emerald-800 text-lg">Net Profit</span>
              <span className="font-bold text-emerald-700 text-lg">₺{data.netProfit.toLocaleString('tr-TR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
