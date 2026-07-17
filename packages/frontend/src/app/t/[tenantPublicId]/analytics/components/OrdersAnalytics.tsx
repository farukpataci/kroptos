'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fetcher = (url: string) => apiFetch(url);

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export function OrdersAnalytics({ filters }: { filters: any }) {
  const queryString = new URLSearchParams(filters).toString();
  const { data, error, isLoading } = useSWR<any>(`/analytics/orders?${queryString}`, fetcher);

  if (isLoading) return <div className="animate-pulse bg-white h-[400px] rounded-xl border border-gray-100"></div>;
  if (error || !data) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Failed to load order data.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Status Funnel</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.funnel} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {data.funnel.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Status Distribution</h3>
          <div className="space-y-4">
            {data.statusDistribution.map((item: any, i: number) => (
              <div key={i} className="flex items-center">
                <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <div className="flex-1 text-sm font-medium text-gray-700">{item.name}</div>
                <div className="text-sm font-bold text-gray-900">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
