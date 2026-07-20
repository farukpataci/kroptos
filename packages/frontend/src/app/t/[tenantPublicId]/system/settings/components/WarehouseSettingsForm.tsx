'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch<any>(url);

export function WarehouseSettingsForm() {
  const { data: tenantSettings, mutate: mutateTenant } = useSWR<any>('/system/tenant-settings', fetcher);
  const { data: warehouses } = useSWR<any[]>('/warehouses', fetcher);
  
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Sync state when data loads
  if (tenantSettings && !formData) {
    setFormData({
      defaultWarehouseId: tenantSettings.defaultWarehouseId || '',
      autoAllocation: tenantSettings.settings?.warehouses?.autoAllocation || false,
      safetyStockEnabled: tenantSettings.settings?.warehouses?.safetyStockEnabled || false,
      safetyStockPercent: tenantSettings.settings?.warehouses?.safetyStockPercent || 10,
    });
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...tenantSettings,
        defaultWarehouseId: formData.defaultWarehouseId,
        settings: {
          ...(tenantSettings.settings || {}),
          warehouses: {
            autoAllocation: formData.autoAllocation,
            safetyStockEnabled: formData.safetyStockEnabled,
            safetyStockPercent: Number(formData.safetyStockPercent),
          },
        },
      };
      await apiFetch('/system/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      mutateTenant(payload);
      toast.success('Warehouse settings saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Warehouse & Inventory Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Manage default stock fulfillment hubs and inventory buffer thresholds.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Default Fulfillment Warehouse</label>
          <select
            name="defaultWarehouseId"
            value={formData.defaultWarehouseId || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select a default warehouse...</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
            {!warehouses?.length && (
              <option value="default-hub">Main Logistics Center (Default Hub)</option>
            )}
          </select>
        </div>

        <div className="flex items-start pt-2">
          <div className="flex h-5 items-center">
            <input
              id="autoAllocation"
              name="autoAllocation"
              type="checkbox"
              checked={formData.autoAllocation || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="autoAllocation" className="font-medium text-gray-700">Automatic Stock Allocation</label>
            <p className="text-gray-500">Automatically reserve inventory stocks in warehouses when order enters system.</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="safetyStockEnabled"
                name="safetyStockEnabled"
                type="checkbox"
                checked={formData.safetyStockEnabled || false}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="safetyStockEnabled" className="font-medium text-gray-700">Enable Safety Stock Buffer</label>
              <p className="text-gray-500">Reserves a percentage of total stock to prevent oversell on active marketplaces.</p>
            </div>
          </div>

          {formData.safetyStockEnabled && (
            <div className="w-1/2 pl-7 animate-scale-in">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Safety Stock Buffer (%)</label>
              <input
                type="number"
                name="safetyStockPercent"
                min={0}
                max={100}
                value={formData.safetyStockPercent}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setFormData(null)}
          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
