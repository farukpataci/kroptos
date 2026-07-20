'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch<any>(url);

export function IntegrationSettingsGrid() {
  const { data: integrations, error, mutate } = useSWR<any[]>('/system/integration-settings', fetcher);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [configData, setConfigData] = useState<any>({});
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (provider: string, currentStatus: string) => {
    const newStatus = currentStatus === 'connected' ? 'disconnected' : 'connected';
    try {
      await apiFetch(`/system/integration-settings/${provider.toLowerCase()}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle integration.');
    }
  };

  const handleEditClick = (integration: any) => {
    setEditingProvider(integration.provider);
    setConfigData(integration.config || {});
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfigData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    setIsSaving(true);
    try {
      await apiFetch(`/system/integration-settings/${editingProvider.toLowerCase()}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'connected',
          config: configData,
        }),
      });
      setEditingProvider(null);
      mutate();
      toast.success('Integration connected and settings saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load integration settings.</div>;
  if (!integrations) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Marketplace & ERP Integrations</h3>
        <p className="mt-1 text-sm text-gray-500">Connect and manage external sales channels and ERP integrations.</p>
      </div>

      {editingProvider ? (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 animate-scale-in">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-bold text-gray-900 uppercase">
              Configure {editingProvider} Integration
            </h4>
            <button onClick={() => setEditingProvider(null)} className="text-gray-400 hover:text-gray-600">
              ✕ Cancel
            </button>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">API Key / Seller ID</label>
              <input
                type="text"
                name="apiKey"
                value={configData.apiKey || ''}
                onChange={handleConfigChange}
                required
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">API Secret / Token</label>
              <input
                type="password"
                name="apiSecret"
                value={configData.apiSecret || ''}
                onChange={handleConfigChange}
                required
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            {editingProvider.toLowerCase() === 'logo' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Server URL</label>
                <input
                  type="url"
                  name="serverUrl"
                  value={configData.serverUrl || ''}
                  onChange={handleConfigChange}
                  required
                  placeholder="https://logo-rest-endpoint.com"
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {isSaving ? 'Connecting...' : 'Save & Connect'}
              </button>
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 text-xs font-semibold bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((item: any) => {
            const isConnected = item.status === 'connected';
            return (
              <div
                key={item.provider}
                className="card flex flex-col justify-between border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow transition-shadow"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-gray-900 capitalize">{item.provider}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-600' : 'bg-gray-400'}`}></span>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    {item.provider === 'logo'
                      ? 'Integrate with Logo Tiger/Go ERP systems.'
                      : `Synchronize products and orders with ${item.provider}.`}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-50">
                  <button
                    onClick={() => handleEditClick(item)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Configure
                  </button>

                  <button
                    onClick={() => handleToggle(item.provider, item.status)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isConnected ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isConnected ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
