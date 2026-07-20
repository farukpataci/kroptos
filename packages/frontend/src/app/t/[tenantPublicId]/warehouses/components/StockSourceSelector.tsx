'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch<any>(url);

const sources = [
  { id: 'manual', name: 'Manual Stock Management', desc: 'Enter and update stocks manually from the panel.', status: 'connected' },
  { id: 'logo', name: 'Logo / ERP Integration', desc: 'Automatically fetch stocks from Logo Tiger/Go3 or Logo REST service.', status: 'disconnected' },
  { id: 'hybrid', name: 'Hybrid Mode', desc: 'Logo as primary source, with reservation and allocation rules managed in the panel.', status: 'connected' },
  { id: 'netsis', name: 'Netsis Integration', desc: 'Synchronize your stocks with Netsis ERP.', status: 'disconnected' },
  { id: 'nebih', name: 'Nebim V3 Integration', desc: 'Nebim ERP stock management connection.', status: 'disconnected' },
  { id: 'parasut', name: 'Paraşüt Integration', desc: 'Stock matching with Paraşüt pre-accounting.', status: 'disconnected' },
];

export function StockSourceSelector() {
  const toast = useToast();
  const { data: settings, mutate } = useSWR('/stock-source/settings', fetcher, {
    fallbackData: { mode: 'hybrid' }
  });

  const [activeMode, setActiveMode] = useState(settings?.mode || 'hybrid');
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    const confirm = window.confirm(`Are you sure you want to change the stock management source to "${id.toUpperCase()}"? This operation may affect existing stock reservation rules.`);
    if (!confirm) return;

    setActiveMode(id);
    try {
      await apiFetch('/stock-source/settings', {
        method: 'PUT',
        body: JSON.stringify({ mode: id })
      });
      mutate({ mode: id });
    } catch (err: any) {
      toast.error(err.message || 'Update failed.');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiFetch('/stock-source/test-connection', {
        method: 'POST',
        body: JSON.stringify({ provider: id })
      });
      toast.success(`${id.toUpperCase()} connection test successful.`);
    } catch (err: any) {
      toast.error(`${id.toUpperCase()} connection error: ` + err.message);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Stock Source Selection</h3>
        <p className="mt-1 text-sm text-gray-500">Determine which system updates stock quantities and configure their priority.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sources.map((src) => {
          const isSelected = activeMode === src.id;
          return (
            <div key={src.id} className={`p-5 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-md ${
              isSelected ? 'border-indigo-600 bg-indigo-50/20' : 'border-gray-200 bg-white'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-900">{src.name}</h4>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    src.status === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {src.status === 'connected' ? 'connected' : 'disconnected'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-6">{src.desc}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSelect(src.id)}
                  className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isSelected ? 'Active' : 'Select'}
                </button>
                {src.id !== 'manual' && (
                  <button
                    type="button"
                    disabled={testingId === src.id}
                    onClick={() => handleTest(src.id)}
                    className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testingId === src.id ? 'Testing...' : 'Test Connection'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
