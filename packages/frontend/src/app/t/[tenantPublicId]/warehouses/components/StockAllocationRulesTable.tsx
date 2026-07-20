'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch<any>(url);

export function StockAllocationRulesTable() {
  const toast = useToast();
  const { data: rules, mutate } = useSWR('/stock-allocation/rules', fetcher, {
    fallbackData: [
      { id: '1', name: 'Trendyol Proportional Distribution', priority: 1, percentAllocation: 40, fixedAllocation: 0, reserveRatio: 5, allocationType: 'PERCENT', provider: 'trendyol', isActive: true },
      { id: '2', name: 'Hepsiburada Distribution', priority: 2, percentAllocation: 30, fixedAllocation: 0, reserveRatio: 5, allocationType: 'PERCENT', provider: 'hepsiburada', isActive: true },
      { id: '3', name: 'Amazon Fixed Distribution', priority: 3, percentAllocation: 0, fixedAllocation: 20, reserveRatio: 0, allocationType: 'FIXED', provider: 'amazon', isActive: true },
    ]
  });

  const [showSim, setShowSim] = useState(false);
  const [simParams, setSimParams] = useState({
    actualStock: 100,
    reservedStock: 10,
    safetyStock: 5,
    damagedStock: 2,
    percentAllocation: 40,
    fixedAllocation: 20,
    reserveRatio: 5,
    allocationType: 'PERCENT',
  });
  const [simResult, setSimResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const runSimulation = async () => {
    setIsCalculating(true);
    try {
      const res = await apiFetch('/stock-allocation/calculate', {
        method: 'POST',
        body: JSON.stringify(simParams)
      });
      setSimResult(res);
    } catch (err: any) {
      toast.error('Simulation calculation error: ' + err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">Stock Allocation Rules</h3>
          <p className="mt-1 text-sm text-gray-500">Rules that determine how stocks will be distributed across marketplaces and channels.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSim(!showSim)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {showSim ? 'Close Simulator' : 'Allocation Simulator / Preview'}
        </button>
      </div>

      {showSim && (
        <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-indigo-900">1. Simulation Inputs</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Actual Stock</label>
                <input
                  type="number"
                  value={simParams.actualStock}
                  onChange={(e) => setSimParams({ ...simParams, actualStock: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Reserved Stock</label>
                <input
                  type="number"
                  value={simParams.reservedStock}
                  onChange={(e) => setSimParams({ ...simParams, reservedStock: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Safety Stock</label>
                <input
                  type="number"
                  value={simParams.safetyStock}
                  onChange={(e) => setSimParams({ ...simParams, safetyStock: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Damaged Stock</label>
                <input
                  type="number"
                  value={simParams.damagedStock}
                  onChange={(e) => setSimParams({ ...simParams, damagedStock: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Allocation Type</label>
                <select
                  value={simParams.allocationType}
                  onChange={(e) => setSimParams({ ...simParams, allocationType: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                >
                  <option value="PERCENT">Percentage Allocation (Percent)</option>
                  <option value="FIXED">Fixed Quantity Allocation (Fixed)</option>
                </select>
              </div>
              {simParams.allocationType === 'PERCENT' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Allocation Ratio (%)</label>
                  <input
                    type="number"
                    value={simParams.percentAllocation}
                    onChange={(e) => setSimParams({ ...simParams, percentAllocation: Number(e.target.value) })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Fixed Quantity</label>
                  <input
                    type="number"
                    value={simParams.fixedAllocation}
                    onChange={(e) => setSimParams({ ...simParams, fixedAllocation: Number(e.target.value) })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Reserve Stock Ratio (%)</label>
                <input
                  type="number"
                  value={simParams.reserveRatio}
                  onChange={(e) => setSimParams({ ...simParams, reserveRatio: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={isCalculating}
              onClick={runSimulation}
              className="w-full inline-flex justify-center items-center py-2 px-4 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCalculating ? 'Calculating...' : 'Calculate Allocation & Preview'}
            </button>
          </div>

          <div className="p-5 bg-white rounded-xl border border-indigo-100/50 flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-indigo-900 mb-4">2. Calculated Stock Preview</h4>
              {simResult ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">Actual Stock</span>
                    <span className="font-semibold text-gray-900">{simResult.actualStock}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">Sellable Stock</span>
                    <span className="font-bold text-indigo-600">{simResult.sellableStock}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-indigo-50/40 px-2 rounded">
                    <span className="text-indigo-900 font-semibold text-sm">Allocated Stock to Publish</span>
                    <span className="font-bold text-indigo-700 text-lg">{simResult.allocatedStock}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 text-sm">Stock Status Risk</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      simResult.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {simResult.riskLevel}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-12 text-sm">
                  After entering the values, you can click the button above to start the allocation simulation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rule Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel (Provider)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reserve</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.map((rule: any) => (
              <tr key={rule.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{rule.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-semibold">{rule.provider.toUpperCase()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.allocationType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {rule.allocationType === 'PERCENT' ? `${rule.percentAllocation}%` : `${rule.fixedAllocation} Units`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.reserveRatio}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
